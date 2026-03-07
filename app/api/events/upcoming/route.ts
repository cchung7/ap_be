import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { optionalAuth } from "@/src/lib/auth";

function combineDateAndTimeToIso(dateValue: Date, time: string) {
  const datePart = dateValue.toISOString().slice(0, 10);
  return new Date(`${datePart}T${time}:00.000Z`).toISOString();
}

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || "3")));

  const tokenUser = await optionalAuth();
  const now = new Date();

  const events = await prisma.event.findMany({
    where: { date: { gt: now } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: limit,
  });

  let registeredSet = new Set<string>();
  if (tokenUser?.id && events.length) {
    const regs = await prisma.eventAttendance.findMany({
      where: {
        userId: tokenUser.id,
        eventId: { in: events.map((e) => e.id) as any },
      },
      select: { eventId: true },
    });
    registeredSet = new Set(regs.map((r) => r.eventId.toString()));
  }

  const data = events.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    startsAt: combineDateAndTimeToIso(e.date, e.startTime),
    endsAt: e.endTime ? combineDateAndTimeToIso(e.date, e.endTime) : undefined,
    location: e.location,
    capacity: e.capacity,
    description: e.description ?? "",
    totalRegistered: e.totalRegistered,
    pointsValue: e.pointsValue,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    isRegistered: tokenUser?.id ? registeredSet.has(e.id.toString()) : false,
    viewerAuthenticated: !!tokenUser?.id,
  }));

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Upcoming events fetched successfully",
    data,
  });
}) as any;