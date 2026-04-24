import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/lib/apiError";
import { withCors, corsPreflight } from "@/src/lib/cors";
import { normalizeEmail } from "@/src/lib/email";
import { passwordResetOtpSchema } from "@/src/lib/zodSchemas";
import { verifyPasswordResetOtp } from "@/src/lib/otp";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

const MAX_OTP_ATTEMPTS = 5;

export const POST = withApiHandler(async (req: NextRequest) => {
  const raw = await req.json();
  const { email, otp } = passwordResetOtpSchema.parse(raw);
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
      passwordResetOtpHash: true,
      passwordResetOtpExpiresAt: true,
      passwordResetOtpAttempts: true,
    },
  });

  if (!user || user.status === "SUSPENDED") {
    throw new ApiError(400, "Invalid or expired password reset code.");
  }

  if (
    !user.passwordResetOtpHash ||
    !user.passwordResetOtpExpiresAt ||
    user.passwordResetOtpExpiresAt < new Date()
  ) {
    throw new ApiError(400, "Invalid or expired password reset code.");
  }

  if ((user.passwordResetOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(
      429,
      "Too many failed attempts. Please request a new password reset code."
    );
  }

  const isValidOtp = verifyPasswordResetOtp({
    email: user.email,
    otp,
    otpHash: user.passwordResetOtpHash,
  });

  if (!isValidOtp) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtpAttempts: {
          increment: 1,
        },
      },
    });

    throw new ApiError(400, "Invalid or expired password reset code.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetOtpVerifiedAt: new Date(),
    },
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "Password reset code verified.",
    data: {},
  });

  return withCors(req, res);
}) as any;