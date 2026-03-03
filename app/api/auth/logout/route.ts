import { NextRequest, NextResponse } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { withCors, corsPreflight } from "@/src/lib/cors";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

export const POST = withApiHandler(async (req?: any) => {
  const payload = sendResponse({
    statusCode: 200,
    success: true,
    message: "Logout successful",
    data: null,
  });

  const res = NextResponse.json(payload, { status: 200 });

  const cookieName = process.env.COOKIE_NAME || "token";
  const secure = (process.env.COOKIE_SECURE || "false") === "true";
  const sameSite =
    (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";

  res.cookies.set(cookieName, "", {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 0,
  });

  return withCors(req as NextRequest, res);
}) as any;