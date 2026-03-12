import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { createEventSchema } from "@/src/lib/zodSchemas";
import { ActivityType } from "@prisma/client";
import { ApiError } from "@/src/lib/apiError";

export const GET = withApiHandler(async () => {
  await requireAuth(["ADMIN"]);

  const events = await prisma.event.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Events fetched successfully",
    data: events,
  });
}) as any;

export const POST = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const admin = await requireAuth(["ADMIN"]);

  const raw = createEventSchema.parse(await request.json());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new ApiError(400, "Date must be in YYYY-MM-DD format");
  }

  const [y, m, d] = raw.date.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid date");
  }

  const created = await prisma.event.create({
    data: {
      title: raw.title,
      category: raw.category,
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