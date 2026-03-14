import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);

  const statusParam = (url.searchParams.get("status") || "ACTIVE").toUpperCase();

  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");

  const paginate = !!limitParam;
  const page = Math.max(1, Number(pageParam || "1"));
  const requestedLimit = Math.max(1, Math.min(200, Number(limitParam || "25")));
  const skip = (page - 1) * requestedLimit;

  // Optional filters
  const searchTerm = (url.searchParams.get("searchTerm") || "").trim();
  const roleParam = (url.searchParams.get("role") || "").toUpperCase();

  const and: any[] = [{ status: statusParam as any }];

  if (roleParam) {
    and.push({ role: roleParam as any });
  }

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

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ pointsTotal: "desc" }, { name: "asc" }],
      ...(paginate ? { skip, take: requestedLimit } : {}),
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

  const effectivePage = paginate ? page : 1;
  const effectiveLimit = paginate ? requestedLimit : users.length;
  const totalPage =
    effectiveLimit > 0 ? Math.max(1, Math.ceil(total / effectiveLimit)) : 1;

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "Users fetched successfully",
    meta: {
      page: effectivePage,
      limit: effectiveLimit,
      total,
      totalPage,
    },
    data: users,
  });

  // Hard no-cache
  res.headers?.set?.(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.headers?.set?.("Pragma", "no-cache");
  res.headers?.set?.("Expires", "0");

  return res;
}) as any;
