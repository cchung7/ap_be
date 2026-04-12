import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { optionalAuth } from "@/src/lib/auth";

type EventStatusFilter = "TODAY" | "UPCOMING" | "PAST";
type EventCurrentStatus = "UPCOMING" | "TODAY" | "PAST";
type AttendanceStatus = "REGISTERED" | "CHECKED_IN" | "CANCELED";

function getChicagoDateKey(input: Date | string | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(input));
}

function getChicagoNowHHMM() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function combineDateAndTimeToLocalDateTimeString(dateValue: Date, time: string) {
  const datePart = dateValue.toISOString().slice(0, 10);
  return `${datePart}T${time}:00`;
}

function getCurrentStatus(
  dateValue: Date,
  startTime: string,
  endTime?: string | null
): EventCurrentStatus {
  const todayKey = getChicagoDateKey(new Date());
  const eventKey = getChicagoDateKey(dateValue);
  const nowHHMM = getChicagoNowHHMM();

  if (eventKey > todayKey) return "UPCOMING";
  if (eventKey < todayKey) return "PAST";

  if (endTime && endTime < nowHHMM) return "PAST";

  return "TODAY";
}

function matchesStatusFilter(
  dateValue: Date,
  startTime: string,
  endTime: string,
  status?: string
) {
  if (!status) return true;

  const normalized = status.toUpperCase() as EventStatusFilter;
  const todayKey = getChicagoDateKey(new Date());
  const eventKey = getChicagoDateKey(dateValue);
  const nowHHMM = getChicagoNowHHMM();

  if (normalized === "TODAY") {
    return eventKey === todayKey;
  }

  if (normalized === "UPCOMING") {
    return eventKey > todayKey || (eventKey === todayKey && startTime >= nowHHMM);
  }

  if (normalized === "PAST") {
    return eventKey < todayKey || (eventKey === todayKey && endTime < nowHHMM);
  }

  return true;
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
  viewerAuthenticated: boolean,
  attendance?: {
    status?: AttendanceStatus;
    checkedInAt?: Date | null;
    pointsAwarded?: number;
  } | null
) {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    startsAt: combineDateAndTimeToLocalDateTimeString(e.date, e.startTime),
    endsAt: e.endTime
      ? combineDateAndTimeToLocalDateTimeString(e.date, e.endTime)
      : undefined,
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
    currentStatus: getCurrentStatus(e.date, e.startTime, e.endTime),
    isRegistered: Boolean(attendance),
    viewerAuthenticated,
    attendanceStatus: attendance?.status,
    checkedInAt: attendance?.checkedInAt ?? undefined,
    pointsAwarded: attendance?.pointsAwarded ?? undefined,
  };
}

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);

  const searchTerm = (url.searchParams.get("searchTerm") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "12")));

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

  const where = and.length ? { AND: and } : {};
  const tokenUser = await optionalAuth();

  const allEvents = await prisma.event.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  let attendanceByEventId = new Map<
    string,
    {
      status?: AttendanceStatus;
      checkedInAt?: Date | null;
      pointsAwarded?: number;
    }
  >();

  if (tokenUser?.id && allEvents.length) {
    const regs = await prisma.eventAttendance.findMany({
      where: {
        userId: tokenUser.id,
        eventId: { in: allEvents.map((e) => e.id) as any },
      },
      select: {
        eventId: true,
        status: true,
        checkedInAt: true,
        pointsAwarded: true,
      },
    });

    attendanceByEventId = new Map(
      regs.map((r) => [
        String(r.eventId),
        {
          status: r.status as AttendanceStatus,
          checkedInAt: r.checkedInAt,
          pointsAwarded: r.pointsAwarded ?? 0,
        },
      ])
    );
  }

  const filteredEvents = allEvents.filter((event) =>
    matchesStatusFilter(event.date, event.startTime, event.endTime, status)
  );

  const total = filteredEvents.length;
  const skip = (page - 1) * limit;
  const pagedEvents = filteredEvents.slice(skip, skip + limit);

  const data = pagedEvents.map((event) =>
    toEventCardDto(
      event,
      !!tokenUser?.id,
      attendanceByEventId.get(String(event.id)) ?? null
    )
  );

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