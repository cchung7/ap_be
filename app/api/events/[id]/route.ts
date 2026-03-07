import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { optionalAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";

function combineDateAndTimeToIso(dateValue: Date, time: string) {
  const datePart = dateValue.toISOString().slice(0, 10);
  return new Date(`${datePart}T${time}:00:00.000Z`).toISOString();
}

export const GET = withApiHandler(async (_req?: any, ctx?: any) => {
  const { params } = ctx as { params: { id: string } };
  const id = params.id;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new ApiError(404, "Event not found");

  const tokenUser = await optionalAuth();

  let isRegistered = false;
  if (tokenUser?.id) {
    const reg = await prisma.eventAttendance.findFirst({
      where: { userId: tokenUser.id, eventId: id },
      select: { id: true },
    });
    isRegistered = !!reg;
  }

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Event details fetched successfully",
    data: {
      id: event.id,
      title: event.title,
      category: event.category,
      startsAt: combineDateAndTimeToIso(event.date, event.startTime),
      endsAt: event.endTime
        ? combineDateAndTimeToIso(event.date, event.endTime)
        : undefined,
      location: event.location,
      capacity: event.capacity,
      description: event.description ?? "",
      totalRegistered: event.totalRegistered,
      pointsValue: event.pointsValue,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      isRegistered,
      viewerAuthenticated: !!tokenUser?.id,
    },
  });
}) as any;