import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (req?: any) => {
  const request = req as Request;
  const url = new URL(request.url);

  // Optional: allow ?status=ACTIVE|PENDING|...
  const statusParam = (url.searchParams.get("status") || "ACTIVE").toUpperCase();

  const users = await prisma.user.findMany({
    where: {
      status: statusParam as any,
    },
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
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "Users fetched successfully",
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