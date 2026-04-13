import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/lib/apiError";
import { generateToken } from "@/src/lib/jwt";
import { withCors, corsPreflight } from "@/src/lib/cors";
import { setAuthCookie } from "@/src/lib/authCookies";
import { normalizeEmail } from "@/src/lib/email";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  academicYear: z.string().optional(),
  major: z.string().optional(),
  password: z.string().min(8),
  profileImageUrl: z.string().url().optional(),
});

export const POST = withApiHandler(async (req?: any) => {
  const request = req as NextRequest;
  const raw = await request.json();

  const {
    firstName,
    lastName,
    email,
    password,
    academicYear,
    major,
    profileImageUrl,
  } = signupSchema.parse(raw);

  const normalizedEmail = normalizeEmail(email);

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) throw new ApiError(400, "Email is already in use");

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: `${firstName} ${lastName}`.trim(),
      email: normalizedEmail,
      password: hashed,
      role: "MEMBER",
      status: "PENDING",
      subRole: null,
      academicYear: academicYear ? academicYear.toString() : null,
      major: major ? major.toString() : null,
      profileImageUrl: profileImageUrl ? profileImageUrl.toString() : null,
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      status: true,
      subRole: true,
      academicYear: true,
      major: true,
      profileImageUrl: true,
    },
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const res = sendResponse({
    statusCode: 201,
    success: true,
    message: "Signup successful",
    data: { role: user.role },
  });

  setAuthCookie(res, token);

  return withCors(request, res);
}) as any;