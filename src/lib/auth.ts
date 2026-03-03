import { cookies } from "next/headers";
import { ApiError } from "./apiError";
import { verifyToken, type TokenPayload } from "./jwt";

export type AllowedRole = "ADMIN" | "MEMBER";

export function getCookieName() {
  return process.env.COOKIE_NAME || "token";
}

export async function optionalAuth(): Promise<(TokenPayload & { iat?: number; exp?: number }) | null> {
  const jar = await cookies();
  const token = jar.get(getCookieName())?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(
  roles?: AllowedRole[]
): Promise<TokenPayload & { iat?: number; exp?: number }> {
  const jar = await cookies();
  const token = jar.get(getCookieName())?.value;

  if (!token) {
    throw new ApiError(401, "Authorization Failed!");
  }

  const user = verifyToken(token);

  if (roles?.length && !roles.includes(user.role as AllowedRole)) {
    throw new ApiError(403, "Forbidden!");
  }

  return user;  
}