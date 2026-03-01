import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";
import { generateCheckinCode, hashCode } from "@/src/lib/checkinCode";
import { ActivityType } from "@prisma/client";

export const POST = withApiHandler(async (_req?: any, ctx?: any) => {
  const { params } = ctx as { params: { id: string } };
  const eventId = params.id;

  const admin = await requireAuth(["ADMIN"]);

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");

  const code = generateCheckinCode(6);
  const hash = hashCode(code);
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { checkInCodeHash: hash, checkInCodeExpires: expires },
  });

  await prisma.recentActivity.create({
    data: {
      activityType: ActivityType.CHECKIN_CODE_ROTATED,
      description: `Admin rotated check-in code for: ${event.title}`,
      userId: admin.id,
      userName: admin.name ?? admin.email,
      metadata: JSON.stringify({ eventId }),
    },
  });

  // Return plaintext code ONLY to admin
  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Check-in code generated successfully",
    data: { eventId: updated.id, code, expiresAt: expires.toISOString() },
  });
}) as any;