import { NextRequest } from "next/server";

import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { optionalAuth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { withCors, corsPreflight } from "@/src/lib/cors";
import {
  clearAuthCookie,
  getAuthCookieName,
  setAuthCookie,
} from "@/src/lib/authCookies";
import { generateToken } from "@/src/lib/jwt";

export const OPTIONS = (req: NextRequest) => corsPreflight(req);

export const GET = withApiHandler(async (req: NextRequest) => {
  const hadCookie = Boolean(req.cookies.get(getAuthCookieName())?.value);
  const tokenUser = await optionalAuth();

  if (!tokenUser) {
    const res = sendResponse({
      statusCode: 200,
      success: true,
      message: "",
      data: { me: null },
    });

    if (hadCookie) {
      clearAuthCookie(res);
    }

    return withCors(req, res);
  }

  const me = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      subRole: true,
      status: true,
      pointsTotal: true,
      academicYear: true,
      major: true,
      profileImageUrl: true,
    },
  });

  if (!me) {
    const res = sendResponse({
      statusCode: 200,
      success: true,
      message: "",
      data: { me: null },
    });

    clearAuthCookie(res);

    return withCors(req, res);
  }

  const refreshedToken = generateToken({
    id: me.id,
    email: me.email,
    role: me.role,
    name: me.name,
  });

  const res = sendResponse({
    statusCode: 200,
    success: true,
    data: { me },
  });

  setAuthCookie(res, refreshedToken);

  return withCors(req, res);
}) as any;