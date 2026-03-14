import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { optionalAuth } from "@/src/lib/auth";

function getUtcDayWindow() {
  const now = new Date();

  const startUTC = new Date(now);
  startUTC.setUTCHours(0, 0, 0, 0);

  const endUTC = new Date(now);
  endUTC.setUTCHours(23, 59, 59, 999);

  const tomorrowStartUTC = new Date(startUTC);
  tomorrowStartUTC.setUTCDate(tomorrowStartUTC.getUTCDate() + 1);

  return { startUTC, endUTC, tomorrowStartUTC };
}

function getNowUtcHHMM() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function combineDateAndTimeToIso(dateValue: Date, time: string) {
  const datePart = dateValue.toISOString().slice(0, 10);
  return new Date(`${datePart}T${time}:00.000Z`).toISOString();
}

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || "3")));

  const tokenUser = await optionalAuth();

  const { startUTC, endUTC, tomorrowStartUTC } = getUtcDayWindow();
  const nowHHMM = getNowUtcHHMM();

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { date: { gte: tomorrowStartUTC } },
        {
          AND: [
            { date: { gte: startUTC, lte: endUTC } },
            { startTime: { gte: nowHHMM } },
          ],
        },
      ],
    },
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
