import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { ApiError } from "./apiError";

export type TokenPayload = {
  id: string;
  email: string;
  role: string;
  name?: string;
};

export function generateToken(payload: TokenPayload) {
  const secret = process.env.JWT_SECRET as Secret;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn });
}

export function verifyToken(token: string): JwtPayload & TokenPayload {
  const secret = process.env.JWT_SECRET as Secret;
  try {
    return jwt.verify(token, secret) as JwtPayload & TokenPayload;
  } catch {
    throw new ApiError(401, "You are not authorized!");
  }
}