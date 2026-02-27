import { cookies } from "next/headers";
import { ApiError } from "./apiError";
import { verifyToken } from "./jwt";

export function getCookieName() {
  return process.env.COOKIE_NAME || "token";
}

export async function optionalAuth() {
  const jar = await cookies();
  const token = jar.get(getCookieName())?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(roles?: string[]) {
  const jar = await cookies();
  const token = jar.get(getCookieName())?.value;

  if (!token) {
    throw new ApiError(401, "You are not authorized!");
  }

  const user = verifyToken(token);

  if (roles?.length && !roles.includes(user.role)) {
    throw new ApiError(403, "Forbidden!");
  }

  return user;
}