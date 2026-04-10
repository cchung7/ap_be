import crypto from "crypto";

export function generateCheckinCode(length = 6) {
  const digits = "0123456789";
  let out = "";

  for (let i = 0; i < length; i++) {
    out += digits[crypto.randomInt(0, digits.length)];
  }

  return out;
}

export function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function verifyCode(code: string, hash: string) {
  return hashCode(code) === hash;
}