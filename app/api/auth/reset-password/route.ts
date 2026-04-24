import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/lib/apiError";
import { withCors, corsPreflight } from "@/src/lib/cors";
import { normalizeEmail } from "@/src/lib/email";
import { resetPasswordSchema } from "@/src/lib/zodSchemas";
import { hashPassword, verifyPassword } from "@/src/lib/password";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

export const POST = withApiHandler(async (req: NextRequest) => {
  const raw = await req.json();
  const { email, password } = resetPasswordSchema.parse(raw);
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      password: true,
      status: true,
      passwordResetOtpHash: true,
      passwordResetOtpExpiresAt: true,
      passwordResetOtpVerifiedAt: true,
    },
  });

  if (!user || user.status === "SUSPENDED") {
    throw new ApiError(400, "Password reset could not be completed.");
  }

  if (
    !user.passwordResetOtpHash ||
    !user.passwordResetOtpExpiresAt ||
    !user.passwordResetOtpVerifiedAt ||
    user.passwordResetOtpExpiresAt < new Date()
  ) {
    throw new ApiError(
      400,
      "Password reset code has not been verified or has expired."
    );
  }

  const isSamePassword = await verifyPassword(password, user.password);

  if (isSamePassword) {
    throw new ApiError(
      400,
      "New password must be different from your current password."
    );
  }

  const nextPasswordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: nextPasswordHash,
      passwordResetOtpHash: null,
      passwordResetOtpExpiresAt: null,
      passwordResetOtpVerifiedAt: null,
      passwordResetOtpAttempts: 0,
    },
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "Password reset successful. Please sign in with your new password.",
    data: {},
  });

  return withCors(req, res);
}) as any;