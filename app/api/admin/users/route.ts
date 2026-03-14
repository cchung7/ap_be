// D:\ap_be\app\api\admin\users\route.ts
import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  await requireAuth(["ADMIN"]);

  const url = new URL(request.url);

  const statusParam = (url.searchParams.get("status") || "").toUpperCase(); // optional
  const roleParam = (url.searchParams.get("role") || "").toUpperCase(); // optional
  const searchTerm = (url.searchParams.get("searchTerm") || "").trim();

  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "25")));
  const skip = (page - 1) * limit;

  const and: any[] = [];

  if (statusParam) and.push({ status: statusParam as any });
  if (roleParam) and.push({ role: roleParam as any });

  if (searchTerm) {
    and.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { major: { contains: searchTerm, mode: "insensitive" } },
        { subRole: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const where = and.length ? { AND: and } : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ pointsTotal: "desc" }, { name: "asc" }],
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
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Admin users fetched successfully",
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data: items,
  });
}) as any;
