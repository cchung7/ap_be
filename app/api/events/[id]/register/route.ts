// D:\ap_be\app\api\events\[id]\register\route.ts
import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";
import { ActivityType } from "@prisma/client";

export const POST = withApiHandler(async (_req?: any, ctx?: any) => {
  const { params } = ctx as { params: { id: string } };
  const eventId = params.id;

  const me = await requireAuth(["ADMIN", "MEMBER"]);

  // ✅ Enforce ACTIVE for event registration
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { status: true, name: true, email: true },
  });

  if (!user) throw new ApiError(401, "Authorization Failed!");
  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Account pending approval");
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");

  if (event.capacity > 0 && event.totalRegistered >= event.capacity) {
    throw new ApiError(400, "Event capacity is full");
  }

  const existing = await prisma.eventAttendance.findFirst({
    where: { userId: me.id, eventId },
  });
  if (existing) {
    throw new ApiError(400, "User already registered for this event");
  }

  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.eventAttendance.create({
      data: {
        userId: me.id,
        eventId,
        status: "REGISTERED",
      },
    });

    await tx.event.update({
      where: { id: eventId },
      data: { totalRegistered: { increment: 1 } },
    });

    await tx.recentActivity.create({
      data: {
        activityType: ActivityType.USER_REGISTERED,
        description: `${user.name ?? user.email} registered for event: ${event.title}`,
        userId: me.id,
        userName: user.name ?? user.email,
        metadata: JSON.stringify({ eventId }),
      },
    });

    return attendance;
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Event registration successful",
    data: result,
  });
}) as any;