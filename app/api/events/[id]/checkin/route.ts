import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";
import { checkinSchema } from "@/src/lib/zodSchemas";
import { verifyCode } from "@/src/lib/checkinCode";
import { ActivityType } from "@prisma/client";

export const POST = withApiHandler(async (req?: any, ctx?: any) => {
  const request = req as Request;
  const { params } = ctx as { params: { id: string } };
  const eventId = params.id;

  const me = await requireAuth(["ADMIN", "MEMBER"]);

  const { code } = checkinSchema.parse(await (request as any).json());

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");

  if (!event.checkInCodeHash || !event.checkInCodeExpires) {
    throw new ApiError(400, "Check-in code is not available");
  }

  if (event.checkInCodeExpires < new Date()) {
    throw new ApiError(400, "Check-in code expired");
  }

  const ok = verifyCode(code, event.checkInCodeHash);
  if (!ok) throw new ApiError(400, "Invalid check-in code");

  const attendance = await prisma.eventAttendance.findFirst({
    where: { userId: me.id, eventId },
  });

  if (!attendance) {
    // Policy choice: allow walk-ins or require registration
    throw new ApiError(400, "You must be registered to check in");
  }

  if (attendance.status === "CHECKED_IN") {
    throw new ApiError(400, "You are already checked in");
  }

  const points = event.pointsValue || 0;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedAttendance = await tx.eventAttendance.update({
      where: { id: attendance.id },
      data: {
        status: "CHECKED_IN",
        checkedInAt: new Date(),
        pointsAwarded: points,
      },
    });

    await tx.user.update({
      where: { id: me.id },
      data: { pointsTotal: { increment: points } },
    });

    await tx.recentActivity.create({
      data: {
        activityType: ActivityType.USER_CHECKED_IN,
        description: `${me.name ?? me.email} checked in to: ${event.title} (+${points} pts)`,
        userId: me.id,
        userName: me.name ?? me.email,
        metadata: JSON.stringify({ eventId, points }),
      },
    });

    return updatedAttendance;
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "체크인이 완료되었습니다",
    data: updated,
  });
}) as any;