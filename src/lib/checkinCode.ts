import crypto from "crypto";

export function generateCheckinCode(length = 6) {
  // digits only is user-friendly for on-site check-in
  const digits = "0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += digits[Math.floor(Math.random() * digits.length)];
  }
  return out;
}

export function hashCode(code: string) {
  // stable hash for DB storage (no secret needed, but you can HMAC if desired)
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function verifyCode(code: string, hash: string) {
  return hashCode(code) === hash;
}