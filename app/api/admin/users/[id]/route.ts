// D:\ap_be\app\api\admin\users\[id]\route.ts
import { withApiHandler } from "@/src/lib/withApiHandler";
import { sendResponse } from "@/src/lib/sendResponse";
import { prisma } from "@/src/lib/prisma";
import { requireAuth } from "@/src/lib/auth";
import { AttendanceStatus, UserRole, UserStatus } from "@prisma/client";

function formatDateLabel(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatAttendanceStatusLabel(status: AttendanceStatus) {
  switch (status) {
    case "CHECKED_IN":
      return "Checked In";
    case "REGISTERED":
      return "Registered";
    case "CANCELED":
      return "Canceled";
    default:
      return status;
  }
}

async function buildMemberResponse(userId: string) {
  const [user, checkedInCount, previewAttendances] = await Promise.all([
    prisma.user.findUnique({
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
        profileImageUrl: true,
        pointsTotal: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.eventAttendance.count({
      where: {
        userId,
        status: "CHECKED_IN",
      },
    }),
    prisma.eventAttendance.findMany({
      where: { userId },
      orderBy: [{ checkedInAt: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        eventId: true,
        status: true,
        pointsAwarded: true,
        event: {
          select: {
            title: true,
            date: true,
          },
        },
      },
    }),
  ]);

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subRole: user.subRole || "",
    status: user.status,
    academicYear: user.academicYear || "",
    major: user.major || "",
    profileImageUrl: user.profileImageUrl || "",
    pointsTotal: user.pointsTotal || 0,
    eventsAttendedCount: checkedInCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    attendancePreview: previewAttendances.map((attendance) => ({
      eventId: attendance.eventId,
      title: attendance.event?.title || "Untitled Event",
      dateLabel: formatDateLabel(attendance.event?.date),
      statusLabel: formatAttendanceStatusLabel(attendance.status) as
        | "Checked In"
        | "Registered"
        | "Canceled",
      pointsAwarded: attendance.pointsAwarded || 0,
    })),
  };
}

function getActorName(user: any) {
  return String(user?.name || user?.email || "Admin");
}

function getActorId(user: any) {
  const raw = user?.userId ?? user?.id ?? null;
  return raw ? String(raw) : null;
}

export const PATCH = withApiHandler(async (req?: any, ctx?: any) => {
  const request = req as Request;
  const authUser = await requireAuth(["ADMIN"]);

  const userId = String(ctx?.params?.id || "");
  if (!userId) {
    return sendResponse({
      statusCode: 400,
      success: false,
      message: "User id is required",
      data: null as any,
    });
  }

  const body = (await request.json().catch(() => ({}))) as {
    role?: string;
    status?: string;
    subRole?: string | null;
  };

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      subRole: true,
    },
  });

  if (!existing) {
    return sendResponse({
      statusCode: 404,
      success: false,
      message: "Member not found",
      data: null as any,
    });
  }

  const updateData: {
    role?: UserRole;
    status?: UserStatus;
    subRole?: string | null;
  } = {};

  if (typeof body.role !== "undefined") {
    if (!["ADMIN", "MEMBER"].includes(body.role)) {
      return sendResponse({
        statusCode: 400,
        success: false,
        message: "Invalid role value",
        data: null as any,
      });
    }
    updateData.role = body.role as UserRole;
  }

  if (typeof body.status !== "undefined") {
    if (!["ACTIVE", "PENDING", "SUSPENDED"].includes(body.status)) {
      return sendResponse({
        statusCode: 400,
        success: false,
        message: "Invalid status value",
        data: null as any,
      });
    }
    updateData.status = body.status as UserStatus;
  }

  if (typeof body.subRole !== "undefined") {
    const trimmed = String(body.subRole || "").trim();
    updateData.subRole = trimmed || null;
  }

  if (!Object.keys(updateData).length) {
    return sendResponse({
      statusCode: 400,
      success: false,
      message: "No valid fields provided for update",
      data: null as any,
    });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      subRole: true,
    },
  });

  const actorName = getActorName(authUser);
  const actorId = getActorId(authUser);

  const changedParts: string[] = [];

  if (typeof updateData.role !== "undefined" && updateData.role !== existing.role) {
    changedParts.push(`role from ${existing.role} to ${updateData.role}`);
  }

  if (typeof updateData.status !== "undefined" && updateData.status !== existing.status) {
    changedParts.push(`status from ${existing.status} to ${updateData.status}`);
  }

  if (
    typeof updateData.subRole !== "undefined" &&
    (updateData.subRole || "") !== (existing.subRole || "")
  ) {
    changedParts.push(
      `sub-role from ${existing.subRole || "—"} to ${updateData.subRole || "—"}`
    );
  }

  let description = `${actorName} updated ${existing.name}'s member record`;

  if (
    existing.status === "PENDING" &&
    updateData.status === "ACTIVE" &&
    changedParts.length === 1
  ) {
    description = `${actorName} approved ${existing.name}'s account`;
  } else if (changedParts.length) {
    description = `${actorName} updated ${existing.name}: ${changedParts.join(", ")}`;
  }

  await prisma.recentActivity.create({
    data: {
      activityType: "GENERAL",
      description,
      userId: actorId,
      userName: actorName,
      metadata: JSON.stringify({
        targetUserId: existing.id,
        targetUserName: existing.name,
        old: {
          role: existing.role,
          status: existing.status,
          subRole: existing.subRole || "",
        },
        next: {
          role: updated.role,
          status: updated.status,
          subRole: updated.subRole || "",
        },
      }),
    },
  });

  const data = await buildMemberResponse(userId);

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Member updated successfully",
    data,
  });
}) as any;

export const DELETE = withApiHandler(async (_req?: any, ctx?: any) => {
  const authUser = await requireAuth(["ADMIN"]);

  const userId = String(ctx?.params?.id || "");
  if (!userId) {
    return sendResponse({
      statusCode: 400,
      success: false,
      message: "User id is required",
      data: null as any,
    });
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!existing) {
    return sendResponse({
      statusCode: 404,
      success: false,
      message: "Member not found",
      data: null as any,
    });
  }

  const actorName = getActorName(authUser);
  const actorId = getActorId(authUser);

  await prisma.$transaction([
    prisma.eventAttendance.deleteMany({
      where: { userId },
    }),
    prisma.user.delete({
      where: { id: userId },
    }),
    prisma.recentActivity.create({
      data: {
        activityType: "GENERAL",
        description: `${actorName} permanently deleted ${existing.name}'s account`,
        userId: actorId,
        userName: actorName,
        metadata: JSON.stringify({
          targetUserId: existing.id,
          targetUserName: existing.name,
          targetUserEmail: existing.email,
        }),
      },
    }),
  ]);

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Member deleted successfully",
    data: {
      id: existing.id,
    },
  });
}) as any;