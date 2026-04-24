import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
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

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

const GENERIC_MESSAGE =
  "If an account exists for that email, a password reset code has been sent.";

const OTP_TTL_MS = 10 * 60 * 1000;

export const POST = withApiHandler(async (req: NextRequest) => {
  const raw = await req.json();
  const { email } = forgotPasswordSchema.parse(raw);
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  if (!user || user.status === "SUSPENDED") {
    const res = sendResponse({
      statusCode: 200,
      success: true,
      message: GENERIC_MESSAGE,
      data: {},
    });

    return withCors(req, res);
  }

  const otp = generateNumericOtp(6);
  const otpHash = hashPasswordResetOtp(user.email, otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

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
    message: GENERIC_MESSAGE,
    data: {},
  });

  return withCors(req, res);
}) as any;