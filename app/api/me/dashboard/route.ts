import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";

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

function isUpcomingOrToday(eventDate?: Date | null, startTime?: string | null) {
  if (!eventDate) return false;

  const todayKey = getChicagoDateKey(new Date());
  const eventKey = getChicagoDateKey(eventDate);
  const nowHHMM = getChicagoNowHHMM();

  if (eventKey > todayKey) return true;
  if (eventKey < todayKey) return false;

  return (startTime || "00:00") >= nowHHMM;
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

  const [activities, attendances, totalEventsAttended, rankedMembers] =
    await Promise.all([
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

      prisma.eventAttendance.count({
        where: {
          userId: me.id,
          status: "CHECKED_IN" as any,
        },
      }),

      prisma.user.findMany({
        where: {
          role: "MEMBER" as any,
          status: "ACTIVE" as any,
        },
        orderBy: [{ pointsTotal: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          pointsTotal: true,
        },
      }),
    ]);

  const upcomingAttendances = attendances
    .filter((attendance) =>
      isUpcomingOrToday(attendance.event?.date, attendance.event?.startTime)
    )
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

  const leaderboardRankIndex = rankedMembers.findIndex((member) => member.id === me.id);
  const leaderboardRank = leaderboardRankIndex >= 0 ? leaderboardRankIndex + 1 : null;

  const leaderboardTopFivePreview = rankedMembers.slice(0, 5).map((member, index) => ({
    rank: index + 1,
    name: member.name,
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
        totalEventsAttended,
        leaderboardRank,
      },
      activities,
      upcomingEventsPreview,
      leaderboardTopFivePreview,
    },
  });
}) as any;