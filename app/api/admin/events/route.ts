import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { createEventSchema } from "@/src/lib/zodSchemas";
import { ActivityType } from "@prisma/client";

export const POST = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const admin = await requireAuth(["ADMIN"]);

  const raw = createEventSchema.parse(await (request as any).json());

  // Convert YYYY-MM-DD to UTC midnight Date (consistent & avoids timezone drift)
  const [y, m, d] = raw.date.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  const created = await prisma.event.create({
    data: {
      title: raw.title,
      date,
      startTime: raw.startTime,
      endTime: raw.endTime,
      location: raw.location,
      description: raw.description,
      capacity: raw.capacity ?? 0,
      pointsValue: raw.pointsValue ?? 0,
    },
  });

  await prisma.recentActivity.create({
    data: {
      activityType: ActivityType.EVENT_CREATED,
      description: `Admin created event: ${created.title}`,
      userId: admin.id,
      userName: admin.name ?? admin.email,
      metadata: JSON.stringify({ eventId: created.id }),
    },
  });

  return sendResponse({
    statusCode: 201,
    success: true,
    message: "Event created successfully",
    data: created,
  });
}) as any;