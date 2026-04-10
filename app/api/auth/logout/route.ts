import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { withCors, corsPreflight } from "@/src/lib/cors";
import { clearAuthCookie } from "@/src/lib/authCookies";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

export const POST = withApiHandler(async (req: NextRequest) => {
  const res = sendResponse({
    statusCode: 200,
    success: true,
    message: "Logout successful",
  });

  clearAuthCookie(res);

  return withCors(req, res);
}) as any;