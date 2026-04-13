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
import { normalizeEmail } from "@/src/lib/email";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  password: true,
  role: true,
  name: true,
  status: true,
} as const;

export const POST = withApiHandler(async (req: NextRequest) => {
  const raw = await req.json();
  const { email, password } = loginSchema.parse(raw);

  const normalizedEmail = normalizeEmail(email);

  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: AUTH_USER_SELECT,
  });

  let shouldRepairEmail = false;

  if (!user) {
    const caseInsensitiveMatches = await prisma.user.findMany({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      take: 2,
      select: AUTH_USER_SELECT,
    });

    if (caseInsensitiveMatches.length > 1) {
      throw new ApiError(
        409,
        "Multiple accounts match this email. Please contact an administrator."
      );
    }

    user = caseInsensitiveMatches[0] ?? null;
    shouldRepairEmail = Boolean(user && user.email !== normalizedEmail);
  }

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

  if (shouldRepairEmail) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: normalizedEmail },
    });

    user = {
      ...user,
      email: normalizedEmail,
    };
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