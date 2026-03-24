import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";

export const GET = withApiHandler(async (_req?: any, ctx?: any) => {
  const { params } = ctx as { params: { id: string } };
  const eventId = params.id;

  await requireAuth(["ADMIN"]);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      capacity: true,
      totalRegistered: true,
      pointsValue: true,
    },
  });

  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  const attendances = await prisma.eventAttendance.findMany({
    where: { eventId },
    orderBy: [{ registeredAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          subRole: true,
          academicYear: true,
          major: true,
          pointsTotal: true,
        },
      },
    },
  });

  const summary = {
    registered: attendances.filter((a) => a.status === "REGISTERED").length,
    checkedIn: attendances.filter((a) => a.status === "CHECKED_IN").length,
    canceled: attendances.filter((a) => a.status === "CANCELED").length,
    total: attendances.length,
  };

  const data = attendances.map((attendance) => ({
    id: attendance.id,
    status: attendance.status,
    registeredAt: attendance.registeredAt,
    checkedInAt: attendance.checkedInAt,
    pointsAwarded: attendance.pointsAwarded,
    user: attendance.user
      ? {
          id: attendance.user.id,
          name: attendance.user.name,
          email: attendance.user.email,
          role: attendance.user.role,
          status: attendance.user.status,
          subRole: attendance.user.subRole,
          academicYear: attendance.user.academicYear,
          major: attendance.user.major,
          pointsTotal: attendance.user.pointsTotal,
        }
      : null,
  }));

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Event attendances fetched successfully",
    data: {
      event,
      summary,
      attendances: data,
    },
  });
}) as any;