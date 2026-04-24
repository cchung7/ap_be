import { NextRequest } from "next/server";

import { ApiError } from "@/src/lib/apiError";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __apRateLimitStore?: Map<string, RateLimitEntry>;
};

const store =
  globalForRateLimit.__apRateLimitStore ??
  new Map<string, RateLimitEntry>();

globalForRateLimit.__apRateLimitStore = store;

export function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return realIp || "unknown";
}

export function getNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];

  if (!raw) return fallback;

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function assertRateLimit({
  key,
  limit,
  windowMs,
  message = "Too many requests. Please try again later.",
}: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return;
  }

  if (current.count >= limit) {
    throw new ApiError(429, message);
  }

  current.count += 1;
  store.set(key, current);
}