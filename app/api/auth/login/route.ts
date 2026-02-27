import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/lib/apiError";
import { generateToken } from "@/src/lib/jwt";
import { verifyPassword } from "@/src/lib/password";
import { loginSchema } from "@/src/lib/zodSchemas";

export const POST = withApiHandler(async (req?: any) => {
  const request = req as NextRequest;
  const raw = await request.json();
  const { email, password } = loginSchema.parse(raw);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, role: true, name: true, status: true },
  });

  if (!user) throw new ApiError(404, "User not found!");

  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new ApiError(400, "비밀번호가 올바르지 않습니다");

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Account is not active");
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const jar = await cookies();
  jar.set(process.env.COOKIE_NAME || "token", token, {
    httpOnly: true,
    secure: (process.env.COOKIE_SECURE || "false") === "true",
    sameSite: (process.env.COOKIE_SAMESITE as any) || "lax",
    path: "/",
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "로그인이 성공적으로 완료되었습니다",
    data: { token, role: user.role },
  });
}) as any;