import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { updateEventSchema } from "@/src/lib/zodSchemas";
import { ApiError } from "@/src/lib/apiError";
import { ActivityType } from "@prisma/client";

export const PATCH = withApiHandler(async (req?: any, ctx?: any) => {
  const request = req as Request;
  const { params } = ctx as { params: { id: string } };
  const id = params.id;

  const admin = await requireAuth(["ADMIN"]);

  const raw = updateEventSchema.parse(await request.json());

  const data: Record<string, unknown> = { ...raw };

  if (raw.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
      throw new ApiError(400, "Date must be in YYYY-MM-DD format");
    }

    const [y, m, d] = raw.date.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(y, m - 1, d));

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, "Invalid date");
    }

    data.date = parsedDate;
  }

  const exists = await prisma.event.findUnique({ where: { id } });
  if (!exists) throw new ApiError(404, "Event not found");

  const updated = await prisma.event.update({
    where: { id },
    data,
  });

  await prisma.recentActivity.create({
    data: {
      activityType: ActivityType.EVENT_UPDATED,
      description: `Admin updated event: ${updated.title}`,
      userId: admin.id,
      userName: admin.name ?? admin.email,
      metadata: JSON.stringify({ eventId: id }),
    },
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Event updated successfully",
    data: updated,
  });
}) as any;

export const DELETE = withApiHandler(async (_req?: any, ctx?: any) => {
  const { params } = ctx as { params: { id: string } };
  const id = params.id;

  const admin = await requireAuth(["ADMIN"]);

  const exists = await prisma.event.findUnique({ where: { id } });
  if (!exists) throw new ApiError(404, "Event not found");

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.eventAttendance.deleteMany({ where: { eventId: id } });

    const ev = await tx.event.delete({ where: { id } });

    await tx.recentActivity.create({
      data: {
        activityType: ActivityType.EVENT_DELETED,
        description: `Admin deleted event: ${ev.title}`,
        userId: admin.id,
        userName: admin.name ?? admin.email,
        metadata: JSON.stringify({ eventId: id }),
      },
    });

    return ev;
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Event deleted successfully",
    data: deleted,
  });
}) as any;