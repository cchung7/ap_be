import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";

function toDashboardEventDto(event: {
  id: string;
  title: string;
  category: "VOLUNTEERING" | "SOCIAL" | "PROFESSIONAL_DEVELOPMENT";
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  totalRegistered: number;
  pointsValue: number;
}) {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    totalRegistered: event.totalRegistered,
    pointsValue: event.pointsValue,
  };
}

export const GET = withApiHandler(async () => {
  await requireAuth(["ADMIN"]);

  const [users, events, activities] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ pointsTotal: "desc" }, { name: "asc" }],
      include: {
        attendances: {
          orderBy: [{ registeredAt: "desc" }],
          take: 5,
          include: {
            event: {
              select: {
                id: true,
                title: true,
                category: true,
                date: true,
                startTime: true,
                endTime: true,
                location: true,
                pointsValue: true,
              },
            },
          },
        },
      },
    }),

    prisma.event.findMany({
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        category: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        totalRegistered: true,
        pointsValue: true,
      },
    }),

    prisma.recentActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        activityType: true,
        description: true,
        createdAt: true,
      },
    }),
  ]);

  const userIds = users.map((user) => user.id);

  const checkedInAttendances = userIds.length
    ? await prisma.eventAttendance.findMany({
        where: {
          userId: { in: userIds },
          status: "CHECKED_IN",
        },
        select: {
          userId: true,
        },
      })
    : [];

  const checkedInCountByUser = new Map<string, number>();

  for (const attendance of checkedInAttendances) {
    checkedInCountByUser.set(
      attendance.userId,
      (checkedInCountByUser.get(attendance.userId) || 0) + 1
    );
  }

  const memberRows = users.map((user) => {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      subRole: user.subRole ?? "",
      status: user.status,
      academicYear: user.academicYear ?? "",
      major: user.major ?? "",
      profileImageUrl: user.profileImageUrl ?? "",
      pointsTotal: user.pointsTotal ?? 0,
      eventsAttendedCount: checkedInCountByUser.get(user.id) || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      attendancePreview: user.attendances.map((attendance) => ({
        attendanceId: attendance.id,
        eventId: attendance.event?.id ?? "",
        title: attendance.event?.title ?? "Untitled Event",
        category: attendance.event?.category ?? "VOLUNTEERING",
        date: attendance.event?.date ?? null,
        startTime: attendance.event?.startTime ?? "",
        endTime: attendance.event?.endTime ?? "",
        location: attendance.event?.location ?? "",
        status: attendance.status,
        pointsValue: attendance.event?.pointsValue ?? 0,
        registeredAt: attendance.registeredAt,
        checkedInAt: attendance.checkedInAt,
        pointsAwarded: attendance.pointsAwarded ?? 0,
      })),
    };
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Admin dashboard fetched successfully",
    data: {
      members: memberRows,
      events: events.map(toDashboardEventDto),
      activities,
    },
  });
}) as any;