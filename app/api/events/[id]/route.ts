import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { optionalAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";

export const GET = withApiHandler(async (_req?: any, ctx?: any) => {
  const { params } = ctx as { params: { id: string } };
  const id = params.id;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new ApiError(404, "Event not found");

  const tokenUser = await optionalAuth();

  let isRegistered = false;
  if (tokenUser?.id) {
    const reg = await prisma.eventAttendance.findFirst({
      where: { userId: tokenUser.id, eventId: id },
      select: { id: true },
    });
    isRegistered = !!reg;
  }

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "이벤트 상세 정보를 성공적으로 불러왔습니다",
    data: { ...event, isRegistered },
  });
}) as any;