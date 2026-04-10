import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";
import { ApiError } from "./apiError";
import { getAuthSessionExpiresIn } from "./authSession";

export type TokenPayload = {
  id: string;
  email: string;
  role: string;
  name?: string;
};

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError(500, "JWT_SECRET is not set");
  }

  return secret as Secret;
}

function getJwtExpiresIn(): SignOptions["expiresIn"] {
  return getAuthSessionExpiresIn();
}

export function generateToken(payload: TokenPayload): string {
  const secret = getJwtSecret();
  const expiresIn = getJwtExpiresIn();

  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn,
  };

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
  } catch (err) {
    if (err instanceof Error && err.name === "TokenExpiredError") {
      throw new ApiError(401, "Session expired. Please sign in again.");
    }

    throw new ApiError(401, "You are not authorized!");
  }
}

export function decodeToken(
  token: string
): (JwtPayload & Partial<TokenPayload>) | null {
  const decodeFn: typeof jwt.decode =
    (jwt as any)?.decode ?? (jwt as any)?.default?.decode;

  if (typeof decodeFn !== "function") {
    return null;
  }

  try {
    const decoded = decodeFn(token);

    if (!decoded || typeof decoded !== "object") {
      return null;
    }

    return decoded as JwtPayload & Partial<TokenPayload>;
  } catch {
    return null;
  }
}