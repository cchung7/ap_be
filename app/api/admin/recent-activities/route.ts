import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  await requireAuth(["ADMIN"]);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.recentActivity.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.recentActivity.count(),
  ]);

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Recent activities fetched successfully",
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data: items,
  });
}) as any;