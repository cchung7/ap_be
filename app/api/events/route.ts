import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { optionalAuth } from "@/src/lib/auth";

function getChicagoBoundariesUTC() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { startUTC: start, endUTC: end };
}

function combineDateAndTimeToIso(dateValue: Date, time: string) {
  const datePart = dateValue.toISOString().slice(0, 10);
  return new Date(`${datePart}T${time}:00.000Z`).toISOString();
}

function toEventCardDto(
  e: {
    id: string;
    title: string;
    category: "VOLUNTEERING" | "SOCIAL" | "PROFESSIONAL_DEVELOPMENT";
    date: Date;
    startTime: string;
    endTime: string;
    location: string;
    description: string | null;
    capacity: number;
    totalRegistered: number;
    pointsValue: number;
    createdAt: Date;
    updatedAt: Date;
  },
  isRegistered: boolean,
  viewerAuthenticated: boolean,
  currentStatus: "UPCOMING" | "TODAY" | "PAST"
) {
  return {
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
    currentStatus,
    isRegistered,
    viewerAuthenticated,
  };
}

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);

  const searchTerm = url.searchParams.get("searchTerm") || "";
  const status = url.searchParams.get("status") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "12")));
  const skip = (page - 1) * limit;

  const and: any[] = [];

  if (searchTerm) {
    and.push({
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
        { location: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const { startUTC, endUTC } = getChicagoBoundariesUTC();

  if (status === "UPCOMING") and.push({ date: { gt: endUTC } });
  if (status === "TODAY") and.push({ date: { gte: startUTC, lte: endUTC } });
  if (status === "PAST") and.push({ date: { lt: startUTC } });

  const where = and.length ? { AND: and } : {};

  const tokenUser = await optionalAuth();

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.event.count({ where }),
  ]);

  let registeredSet = new Set<string>();
  if (tokenUser?.id) {
    const regs = await prisma.eventAttendance.findMany({
      where: { userId: tokenUser.id },
      select: { eventId: true },
    });
    registeredSet = new Set(regs.map((r) => r.eventId.toString()));
  }

  const data = events.map((e) => {
    let currentStatus: "UPCOMING" | "TODAY" | "PAST" = "UPCOMING";
    if (e.date > endUTC) currentStatus = "UPCOMING";
    else if (e.date >= startUTC && e.date <= endUTC) currentStatus = "TODAY";
    else currentStatus = "PAST";

    return toEventCardDto(
      e,
      tokenUser?.id ? registeredSet.has(e.id.toString()) : false,
      !!tokenUser?.id,
      currentStatus
    );
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Events fetched successfully",
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  });
}) as any;