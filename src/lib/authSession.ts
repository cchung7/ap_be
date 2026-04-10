import type { SignOptions } from "jsonwebtoken";

const DEFAULT_AUTH_SESSION_EXPIRES_IN = "12h";
const DEFAULT_AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function getAuthSessionExpiresIn(): SignOptions["expiresIn"] {
  const raw =
    process.env.AUTH_SESSION_EXPIRES_IN ||
    process.env.JWT_EXPIRES_IN ||
    DEFAULT_AUTH_SESSION_EXPIRES_IN;

  return raw as SignOptions["expiresIn"];
}

export function parseExpiresInToSeconds(
  value: string | number | undefined | null,
  fallbackSeconds = DEFAULT_AUTH_SESSION_MAX_AGE_SECONDS
) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== "string") {
    return fallbackSeconds;
  }

  const normalized = value.trim();

  if (!normalized) {
    return fallbackSeconds;
  }

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : fallbackSeconds;
  }

  const match = normalized.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackSeconds;
  }

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      return fallbackSeconds;
  }
}

export function getAuthSessionMaxAgeSeconds() {
  return parseExpiresInToSeconds(
    getAuthSessionExpiresIn(),
    DEFAULT_AUTH_SESSION_MAX_AGE_SECONDS
  );
}

export function getAuthSessionMaxAgeMs() {
  return getAuthSessionMaxAgeSeconds() * 1000;
}

export function getAuthSessionExpiresAt(fromMs = Date.now()) {
  return new Date(fromMs + getAuthSessionMaxAgeMs());
}