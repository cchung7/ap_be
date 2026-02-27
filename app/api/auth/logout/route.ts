import { cookies } from "next/headers";
import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";

export const POST = withApiHandler(async () => {
  const jar = await cookies();
  jar.set(process.env.COOKIE_NAME || "token", "", {
    httpOnly: true,
    secure: (process.env.COOKIE_SECURE || "false") === "true",
    sameSite: (process.env.COOKIE_SAMESITE as any) || "lax",
    path: "/",
    maxAge: 0,
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "로그아웃이 성공적으로 완료되었습니다",
    data: null,
  });
});