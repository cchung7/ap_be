// D:\ap_be\app\api\admin\users\route.ts
import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { AttendanceStatus } from "@prisma/client";

function formatDateLabel(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatAttendanceStatusLabel(status: AttendanceStatus) {
  switch (status) {
    case "CHECKED_IN":
      return "Checked In";
    case "REGISTERED":
      return "Registered";
    case "CANCELED":
      return "Canceled";
    default:
      return status;
  }
}

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  await requireAuth(["ADMIN"]);

  const url = new URL(request.url);

  const statusParam = (url.searchParams.get("status") || "").toUpperCase();
  const roleParam = (url.searchParams.get("role") || "").toUpperCase();
  const searchTerm = (url.searchParams.get("searchTerm") || "").trim();

  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "25")));
  const skip = (page - 1) * limit;

  const and: any[] = [];

  if (statusParam) and.push({ status: statusParam as any });
  if (roleParam) and.push({ role: roleParam as any });

  if (searchTerm) {
    and.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { major: { contains: searchTerm, mode: "insensitive" } },
        { subRole: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const where = and.length ? { AND: and } : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ pointsTotal: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subRole: true,
        status: true,
        pointsTotal: true,
        academicYear: true,
        major: true,
        profileImageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = items.map((item) => item.id);

  const [checkedInAttendances, previewAttendances] = userIds.length
    ? await Promise.all([
        prisma.eventAttendance.findMany({
          where: {
            userId: { in: userIds },
            status: "CHECKED_IN",
          },
          select: {
            userId: true,
          },
        }),
        prisma.eventAttendance.findMany({
          where: {
            userId: { in: userIds },
          },
          orderBy: [{ checkedInAt: "desc" }, { createdAt: "desc" }],
          select: {
            userId: true,
            eventId: true,
            status: true,
            pointsAwarded: true,
            event: {
              select: {
                title: true,
                date: true,
              },
            },
          },
        }),
      ])
    : [[], []];

  const eventsAttendedCountByUser = new Map<string, number>();
  for (const attendance of checkedInAttendances) {
    eventsAttendedCountByUser.set(
      attendance.userId,
      (eventsAttendedCountByUser.get(attendance.userId) || 0) + 1
    );
  }

  const attendancePreviewByUser = new Map<
    string,
    Array<{
      eventId: string;
      title: string;
      dateLabel: string;
      statusLabel: "Checked In" | "Registered" | "Canceled";
      pointsAwarded: number;
    }>
  >();

  for (const attendance of previewAttendances) {
    const current = attendancePreviewByUser.get(attendance.userId) || [];
    if (current.length >= 3) continue;

    current.push({
      eventId: attendance.eventId,
      title: attendance.event?.title || "Untitled Event",
      dateLabel: formatDateLabel(attendance.event?.date),
      statusLabel: formatAttendanceStatusLabel(attendance.status) as
        | "Checked In"
        | "Registered"
        | "Canceled",
      pointsAwarded: attendance.pointsAwarded || 0,
    });

    attendancePreviewByUser.set(attendance.userId, current);
  }

  const data = items.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    subRole: item.subRole || "",
    status: item.status,
    academicYear: item.academicYear || "",
    major: item.major || "",
    pointsTotal: item.pointsTotal || 0,
    eventsAttendedCount: eventsAttendedCountByUser.get(item.id) || 0,
    profileImageUrl: item.profileImageUrl || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    attendancePreview: attendancePreviewByUser.get(item.id) || [],
  }));

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Admin users fetched successfully",
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data,
  });
}) as any;