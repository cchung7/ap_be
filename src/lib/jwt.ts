import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";
import { ApiError } from "./apiError";

export type TokenPayload = {
  id: string;
  email: string;
  role: string;
  name?: string;
};

function getJwtSecret(): Secret {
  const s = process.env.JWT_SECRET;
  if (!s) throw new ApiError(500, "JWT_SECRET is not set");
  return s as Secret;
}

function getJwtExpiresIn(): SignOptions["expiresIn"] {
  // jsonwebtoken supports "7d", "1h", seconds as number, etc.
  // Keeping it as SignOptions["expiresIn"] avoids TS pain.
  return (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
}

export function generateToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  const expiresIn = getJwtExpiresIn();

  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn,
  };

  // Ensure we call the correct function even if module interop is weird
  const signFn: typeof jwt.sign =
    (jwt as any)?.sign ?? (jwt as any)?.default?.sign;

  if (typeof signFn !== "function") {
    throw new ApiError(
      500,
      "jsonwebtoken import is misconfigured: jwt.sign is not a function"
    );
  }

  return signFn(payload, secret, options);
}

export function verifyToken(token: string): JwtPayload & TokenPayload {
  const secret = getJwtSecret();

  const verifyFn: typeof jwt.verify =
    (jwt as any)?.verify ?? (jwt as any)?.default?.verify;

  if (typeof verifyFn !== "function") {
    throw new ApiError(
      500,
      "jsonwebtoken import is misconfigured: jwt.verify is not a function"
    );
  }

  try {
    return verifyFn(token, secret) as JwtPayload & TokenPayload;
  } catch {
    throw new ApiError(401, "You are not authorized!");
  }
}