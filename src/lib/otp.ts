import crypto from "crypto";

const OTP_LENGTH = 6;

function getOtpHashSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required to hash password reset OTPs.");
  }

  return secret;
}

export function generateNumericOtp(length = OTP_LENGTH) {
  if (length < 4 || length > 10) {
    throw new Error("OTP length must be between 4 and 10 digits.");
  }

  const min = 10 ** (length - 1);
  const max = 10 ** length;

  return String(crypto.randomInt(min, max));
}

export function hashPasswordResetOtp(email: string, otp: string) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedOtp = String(otp ?? "").trim();

  return crypto
    .createHmac("sha256", getOtpHashSecret())
    .update(`${normalizedEmail}:${normalizedOtp}`)
    .digest("hex");
}

export function verifyPasswordResetOtp({
  email,
  otp,
  otpHash,
}: {
  email: string;
  otp: string;
  otpHash: string;
}) {
  const nextHash = hashPasswordResetOtp(email, otp);

  const left = Buffer.from(nextHash, "hex");
  const right = Buffer.from(otpHash, "hex");

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}