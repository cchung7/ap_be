import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/apiError";
import { hashPassword, verifyPassword } from "@/src/lib/password";
import { updateProfileSchema } from "@/src/lib/zodSchemas";
import { normalizeEmail } from "@/src/lib/email";

function getAuthUserId(authUser: unknown) {
  const candidate = (authUser as any)?.userId ?? (authUser as any)?.id ?? null;

  return candidate ? String(candidate) : "";
}

function normalizeOptionalText(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toProfileDto(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  subRole: string | null;
  status: string;
  academicYear: string | null;
  major: string | null;
  pointsTotal: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subRole: user.subRole,
    status: user.status,
    academicYear: user.academicYear,
    major: user.major,
    pointsTotal: user.pointsTotal,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const GET = withApiHandler(async () => {
  const authUser = await requireAuth(["ADMIN", "MEMBER"]);
  const userId = getAuthUserId(authUser);

  if (!userId) {
    throw new ApiError(401, "Authorization Failed!");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subRole: true,
      status: true,
      academicYear: true,
      major: true,
      pointsTotal: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Profile fetched successfully.",
    data: {
      profile: toProfileDto(user),
    },
  });
}) as any;

export const PATCH = withApiHandler(async (req: Request) => {
  const authUser = await requireAuth(["ADMIN", "MEMBER"]);
  const userId = getAuthUserId(authUser);

  if (!userId) {
    throw new ApiError(401, "Authorization Failed!");
  }

  const body = await req.json();
  const payload = updateProfileSchema.parse(body);

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
      subRole: true,
      status: true,
      academicYear: true,
      major: true,
      pointsTotal: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found.");
  }

  const wantsPasswordChange = Boolean(
    payload.currentPassword || payload.newPassword || payload.confirmNewPassword
  );

  if (wantsPasswordChange) {
    const isValidCurrentPassword = await verifyPassword(
      payload.currentPassword || "",
      existingUser.password
    );

    if (!isValidCurrentPassword) {
      throw new ApiError(400, "Current password is incorrect.", [
        { field: "currentPassword", message: "Current password is incorrect." },
      ]);
    }
  }

  const updateData: any = {
    name: payload.name.trim(),
    email: normalizeEmail(payload.email),
    academicYear: normalizeOptionalText(payload.academicYear),
    major: normalizeOptionalText(payload.major),
  };

  if (wantsPasswordChange && payload.newPassword) {
    updateData.password = await hashPassword(payload.newPassword);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subRole: true,
      status: true,
      academicYear: true,
      major: true,
      pointsTotal: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: wantsPasswordChange
      ? "Profile and password updated successfully."
      : "Profile updated successfully.",
    data: {
      profile: toProfileDto(updatedUser),
    },
  });
}) as any;