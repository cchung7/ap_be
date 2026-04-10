import { cookies } from "next/headers";
import { ApiError } from "./apiError";
import { verifyToken, type TokenPayload } from "./jwt";
import { getAuthCookieName } from "./authCookies";

export type AllowedRole = "ADMIN" | "MEMBER";

export async function optionalAuth(): Promise<
  (TokenPayload & { iat?: number; exp?: number }) | null
> {
  const jar = await cookies();
  const token = jar.get(getAuthCookieName())?.value;

  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(
  roles?: AllowedRole[]
): Promise<TokenPayload & { iat?: number; exp?: number }> {
  const jar = await cookies();
  const token = jar.get(getAuthCookieName())?.value;

  if (!token) {
    throw new ApiError(401, "Authorization Failed!");
  }

  let user: TokenPayload & { iat?: number; exp?: number };

  try {
    user = verifyToken(token);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }

    throw new ApiError(401, "Authorization Failed!");
  }

  if (roles?.length && !roles.includes(user.role as AllowedRole)) {
    throw new ApiError(403, "Forbidden!");
  }

  return user;
}