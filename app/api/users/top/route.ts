import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("limit") || "3"))
  );

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      // role filter removed so ADMIN can appear in ranking
    },
    orderBy: { pointsTotal: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subRole: true,
      status: true,
      pointsTotal: true,
      academicYear: true,
      major: true,
      profileImageUrl: true,
    },
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "Top users fetched successfully",
    data: users,
  });

  // ensure no caching
  res.headers?.set?.(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.headers?.set?.("Pragma", "no-cache");
  res.headers?.set?.("Expires", "0");

  return res;
}) as any;