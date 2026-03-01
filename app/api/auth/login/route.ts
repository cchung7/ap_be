import { NextRequest, NextResponse } from "next/server";

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
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      name: true,
      status: true,
    },
  });

  if (!user) throw new ApiError(404, "User not found");

  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new ApiError(400, "Password is incorrect");

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Account is not active");
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  // Build the JSON response using your existing helper
  const payload = sendResponse({
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: { token, role: user.role },
  });

  // Set cookie on the response
  const res = NextResponse.json(payload, { status: 200 });

  const cookieName = process.env.COOKIE_NAME || "token";
  const secure = (process.env.COOKIE_SECURE || "false") === "true";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";

  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    // optional but recommended:
    // maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}) as any;