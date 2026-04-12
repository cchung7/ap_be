import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/lib/apiError";
import { generateToken } from "@/src/lib/jwt";
import { verifyPassword } from "@/src/lib/password";
import { loginSchema } from "@/src/lib/zodSchemas";
import { withCors, corsPreflight } from "@/src/lib/cors";
import { setAuthCookie } from "@/src/lib/authCookies";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

export const POST = withApiHandler(async (req: NextRequest) => {
  const raw = await req.json();
  const { email, password } = loginSchema.parse(raw);

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      name: true,
      status: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isValidPassword = await verifyPassword(password, user.password);

  if (!isValidPassword) {
    throw new ApiError(400, "Password is incorrect");
  }

  // PENDING users are allowed to log in.
  // Their restrictions should be enforced at the feature/authorization layer
  // (e.g. event registration, event check-in, membership list visibility).
  if (user.status === "SUSPENDED") {
    throw new ApiError(
      403,
      "Account has been suspended. Please contact your administrator."
    );
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message:
      user.status === "PENDING"
        ? "Login successful. Your account is pending approval."
        : "Login successful",
    data: {
      role: user.role,
      status: user.status,
    },
  });

  setAuthCookie(res, token);

  return withCors(req, res);
}) as any;