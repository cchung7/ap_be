import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/lib/apiError";
import { withCors, corsPreflight } from "@/src/lib/cors";
import { normalizeEmail } from "@/src/lib/email";
import { forgotPasswordSchema } from "@/src/lib/zodSchemas";
import {
  generateNumericOtp,
  hashPasswordResetOtp,
} from "@/src/lib/otp";
import { sendEmail } from "@/src/lib/mailer";
import {
  buildPasswordResetOtpEmailHtml,
  buildPasswordResetOtpEmailText,
} from "@/src/lib/passwordResetEmail";
import {
  assertRateLimit,
  getClientIp,
  getNumberEnv,
} from "@/src/lib/rateLimit";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

function getPasswordResetRateLimitConfig() {
  return {
    windowMs: getNumberEnv(
      "PASSWORD_RESET_RATE_LIMIT_WINDOW_MS",
      60 * 60 * 1000
    ),
    maxRequests: getNumberEnv("PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS", 3),
  };
}

function getOtpTtlMs() {
  const ttlMinutes = getNumberEnv("PASSWORD_RESET_OTP_TTL_MINUTES", 15);
  return ttlMinutes * 60 * 1000;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const raw = await req.json();
  const { email } = forgotPasswordSchema.parse(raw);
  const normalizedEmail = normalizeEmail(email);

  const clientIp = getClientIp(req);
  const rateLimitConfig = getPasswordResetRateLimitConfig();

  assertRateLimit({
    key: `password-reset-send:${clientIp}:${normalizedEmail}`,
    limit: rateLimitConfig.maxRequests,
    windowMs: rateLimitConfig.windowMs,
    message:
      "Too many password reset requests. Please wait before requesting another code.",
  });

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "No account was found with that email address.");
  }

  if (user.status === "SUSPENDED") {
    throw new ApiError(
      403,
      "This account is suspended. Please contact an administrator."
    );
  }

  const otp = generateNumericOtp(6);
  const otpHash = hashPasswordResetOtp(user.email, otp);
  const expiresAt = new Date(Date.now() + getOtpTtlMs());

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetOtpHash: otpHash,
      passwordResetOtpExpiresAt: expiresAt,
      passwordResetOtpVerifiedAt: null,
      passwordResetOtpAttempts: 0,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "SVA | UT-Dallas - Password Reset Code",
    html: buildPasswordResetOtpEmailHtml(otp),
    text: buildPasswordResetOtpEmailText(otp),
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "A password reset code has been sent to your email.",
    data: {},
  });

  return withCors(req, res);
}) as any;