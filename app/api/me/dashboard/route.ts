import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";

function getUtcDayStart() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart;
}

export const GET = withApiHandler(async () => {
  const tokenUser = await requireAuth(["ADMIN", "MEMBER"]);

  const me = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      subRole: true,
      status: true,
      pointsTotal: true,
      academicYear: true,
      major: true,
      profileImageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!me) {
    throw new ApiError(404, "User not found");
  }

  const utcDayStart = getUtcDayStart();

  const [activities, attendances] = await Promise.all([
    prisma.recentActivity.findMany({
      where: {
        userId: me.id,
        activityType: {
          in: ["USER_REGISTERED", "USER_CHECKED_IN"] as any,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        activityType: true,
        description: true,
        createdAt: true,
      },
    }),

    prisma.eventAttendance.findMany({
      where: {
        userId: me.id,
        status: {
          in: ["REGISTERED", "CHECKED_IN"] as any,
        },
      },
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
            description: true,
            pointsValue: true,
          },
        },
      },
    }),
  ]);

  const upcomingAttendances = attendances
    .filter((attendance) => {
      const eventDate = attendance.event?.date;
      if (!eventDate) return false;
      return new Date(eventDate) >= utcDayStart;
    })
    .sort((a, b) => {
      const aTime = new Date(a.event?.date || 0).getTime();
      const bTime = new Date(b.event?.date || 0).getTime();
      return aTime - bTime;
    });

  const upcomingEventsPreview = upcomingAttendances.slice(0, 5).map((attendance) => ({
    attendanceId: attendance.id,
    eventId: attendance.event?.id || "",
    title: attendance.event?.title || "Untitled Event",
    category: attendance.event?.category || "VOLUNTEERING",
    date: attendance.event?.date || null,
    startTime: attendance.event?.startTime || "",
    endTime: attendance.event?.endTime || "",
    location: attendance.event?.location || "",
    status: attendance.status,
    pointsValue: attendance.event?.pointsValue ?? 0,
    registeredAt: attendance.registeredAt,
    checkedInAt: attendance.checkedInAt,
    pointsAwarded: attendance.pointsAwarded,
  }));

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Member dashboard fetched successfully",
    data: {
      me,
      stats: {
        upcomingEvents: upcomingAttendances.length,
        totalPoints: me.pointsTotal ?? 0,
      },
      activities,
      upcomingEventsPreview,
    },
  });
}) as any;