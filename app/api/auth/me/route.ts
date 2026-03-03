import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { optionalAuth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export const GET = withApiHandler(async () => {
  const tokenUser = await optionalAuth();

  if (!tokenUser) {
    return sendResponse({
      statusCode: 200,
      success: true,
      message: "",
      data: { me: null },
    });
  }

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
    },
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    data: { me },
  });
});