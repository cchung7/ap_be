import type { NextResponse } from "next/server";
import {
  getAuthSessionExpiresAt,
  getAuthSessionMaxAgeSeconds,
} from "./authSession";

type SupportedSameSite = "lax" | "strict" | "none";

export function getAuthCookieName() {
  return process.env.COOKIE_NAME || "token";
}

export function getAuthCookieSecure() {
  return (process.env.COOKIE_SECURE || "false") === "true";
}

export function getAuthCookieSameSite(): SupportedSameSite {
  const raw = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

  if (raw === "strict" || raw === "none") {
    return raw;
  }

  return "lax";
}

export function setAuthCookie(res: NextResponse, token: string) {
  const maxAge = getAuthSessionMaxAgeSeconds();

  res.cookies.set(getAuthCookieName(), token, {
    httpOnly: true,
    secure: getAuthCookieSecure(),
    sameSite: getAuthCookieSameSite(),
    path: "/",
    maxAge,
    expires: getAuthSessionExpiresAt(),
  });

  return res;
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    secure: getAuthCookieSecure(),
    sameSite: getAuthCookieSameSite(),
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return res;
}