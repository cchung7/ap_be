import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";
import { checkinSchema } from "@/src/lib/zodSchemas";
import { verifyCode } from "@/src/lib/checkinCode";
import { ActivityType } from "@prisma/client";

const MAX_FAILED_CHECKIN_ATTEMPTS = 5;
const CHECKIN_LOCKOUT_MS = 15 * 60 * 1000;

export const POST = withApiHandler(async (req?: any, ctx?: any) => {
  const request = req as Request;
  const { params } = ctx as { params: { id: string } };
  const eventId = params.id;

  const me = await requireAuth(["ADMIN", "MEMBER"]);

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { status: true, name: true, email: true },
  });

  if (!user) {
    throw new ApiError(401, "Authorization Failed!");
  }

  if (user.status === "PENDING") {
    throw new ApiError(403, "Account pending approval");
  }

  if (user.status === "SUSPENDED") {
    throw new ApiError(403, "Account is inactive");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Access denied");
  }

  const parsed = checkinSchema.parse(await request.json());
  const code = parsed.code.trim();

  const attendance = await prisma.eventAttendance.findFirst({
    where: { userId: me.id, eventId },
    select: {
      id: true,
      status: true,
      failedCheckInAttempts: true,
      checkInLockedUntil: true,
    },
  });

  if (!attendance) {
    throw new ApiError(400, "You must be registered to check in");
  }

  if (attendance.status === "CHECKED_IN") {
    throw new ApiError(400, "You are already checked in");
  }

  if (attendance.status !== "REGISTERED") {
    throw new ApiError(400, "Attendance is not eligible for check-in");
  }

  if (
    attendance.checkInLockedUntil &&
    attendance.checkInLockedUntil > new Date()
  ) {
    const secondsLeft = Math.ceil(
      (attendance.checkInLockedUntil.getTime() - Date.now()) / 1000
    );

    throw new ApiError(
      429,
      `Too many failed attempts. Try again in ${secondsLeft} seconds.`
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      pointsValue: true,
      checkInCodeHash: true,
      checkInCodeExpires: true,
    },
  });

  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  if (!event.checkInCodeHash || !event.checkInCodeExpires) {
    throw new ApiError(400, "Check-in code is not available");
  }

  if (event.checkInCodeExpires < new Date()) {
    throw new ApiError(400, "Check-in code expired");
  }

  const ok = verifyCode(code, event.checkInCodeHash);

  if (!ok) {
    const newFailCount = (attendance.failedCheckInAttempts ?? 0) + 1;
    const shouldLock = newFailCount >= MAX_FAILED_CHECKIN_ATTEMPTS;
    const lockUntil = shouldLock
      ? new Date(Date.now() + CHECKIN_LOCKOUT_MS)
      : null;

    await prisma.eventAttendance.update({
      where: { id: attendance.id },
      data: {
        failedCheckInAttempts: newFailCount,
        checkInLockedUntil: lockUntil,
      },
    });

    if (shouldLock) {
      throw new ApiError(
        429,
        "Too many failed attempts. Check-in is locked for 15 minutes."
      );
    }

    throw new ApiError(400, "Invalid check-in code");
  }

  const points = event.pointsValue || 0;
  const checkedInAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const attendanceUpdate = await tx.eventAttendance.updateMany({
      where: {
        id: attendance.id,
        status: "REGISTERED",
      },
      data: {
        status: "CHECKED_IN",
        checkedInAt,
        pointsAwarded: points,
        failedCheckInAttempts: 0,
        checkInLockedUntil: null,
      },
    });

    if (attendanceUpdate.count !== 1) {
      throw new ApiError(
        409,
        "Attendance status changed. Please refresh and try again."
      );
    }

    await tx.user.update({
      where: { id: me.id },
      data: { pointsTotal: { increment: points } },
    });

    await tx.recentActivity.create({
      data: {
        activityType: ActivityType.USER_CHECKED_IN,
        description: `${user.name ?? user.email} checked in to: ${event.title} (+${points} pts)`,
        userId: me.id,
        userName: user.name ?? user.email,
        metadata: JSON.stringify({ eventId, points }),
      },
    });

    const refreshedAttendance = await tx.eventAttendance.findUnique({
      where: { id: attendance.id },
    });

    if (!refreshedAttendance) {
      throw new ApiError(500, "Failed to load updated attendance");
    }

    return refreshedAttendance;
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Check-in successful",
    data: updated,
  });
}) as any;