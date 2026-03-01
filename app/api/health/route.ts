import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";

export const GET = withApiHandler(async () => {
  await prisma.user.count();

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "OK",
    data: {
      status: "ok",
      service: "ap_be",
      time: new Date().toISOString(),
    },
  });
}) as any;