import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";

export const GET = withApiHandler(async () => {
  const tokenUser = await requireAuth(["ADMIN", "MEMBER"]);

  const attendances = await prisma.eventAttendance.findMany({
    where: {
      userId: tokenUser.id,
    },
    orderBy: [{ registeredAt: "desc" }],
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
          capacity: true,
          totalRegistered: true,
        },
      },
    },
  });

  const data = attendances.map((attendance) => ({
    id: attendance.id,
    status: attendance.status,
    registeredAt: attendance.registeredAt,
    checkedInAt: attendance.checkedInAt,
    pointsAwarded: attendance.pointsAwarded,
    createdAt: attendance.createdAt,
    updatedAt: attendance.updatedAt,
    event: attendance.event
      ? {
          id: attendance.event.id,
          title: attendance.event.title,
          category: attendance.event.category,
          date: attendance.event.date,
          startTime: attendance.event.startTime,
          endTime: attendance.event.endTime,
          location: attendance.event.location,
          description: attendance.event.description,
          pointsValue: attendance.event.pointsValue,
          capacity: attendance.event.capacity,
          totalRegistered: attendance.event.totalRegistered,
        }
      : null,
  }));

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Member attendances fetched successfully",
    data,
  });
}) as any;