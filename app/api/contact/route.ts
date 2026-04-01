import nodemailer from "nodemailer";
import { NextRequest } from "next/server";

import { ApiError } from "@/src/lib/apiError";
import { sendResponse } from "@/src/lib/sendResponse";
import { withApiHandler } from "@/src/lib/withApiHandler";

export const runtime = "nodejs";

type ContactPayload = {
  fullName?: string;
  email?: string;
  body?: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMIT_WINDOW_MS = getEnvNumber(
  "CONTACT_RATE_LIMIT_WINDOW_MS",
  15 * 60 * 1000
);

const RATE_LIMIT_MAX_REQUESTS = getEnvNumber(
  "CONTACT_RATE_LIMIT_MAX_REQUESTS",
  3
);

function cleanupRateLimitStore(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIp(req: NextRequest) {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function assertWithinRateLimit(ip: string) {
  const now = Date.now();

  cleanupRateLimitStore(now);

  const existing = rateLimitStore.get(ip);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new ApiError(
      429,
      "Too many messages sent. Please try again later."
    );
  }

  existing.count += 1;
  rateLimitStore.set(ip, existing);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContactPayload(payload: ContactPayload) {
  const fullName = String(payload.fullName ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const body = String(payload.body ?? "").trim();

  if (!fullName) {
    throw new ApiError(400, "Please provide your full name.", [
      { field: "fullName", message: "Full name is required." },
    ]);
  }

  if (fullName.length > 100) {
    throw new ApiError(400, "Please provide a shorter full name.", [
      { field: "fullName", message: "Full name must be 100 characters or fewer." },
    ]);
  }

  if (!email) {
    throw new ApiError(400, "Please provide your email address.", [
      { field: "email", message: "Email is required." },
    ]);
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, "Please provide a valid email address.", [
      { field: "email", message: "Email format is invalid." },
    ]);
  }

  if (email.length > 254) {
    throw new ApiError(400, "Please provide a shorter email address.", [
      { field: "email", message: "Email must be 254 characters or fewer." },
    ]);
  }

  if (!body) {
    throw new ApiError(400, "Please enter a message before sending.", [
      { field: "body", message: "Message is required." },
    ]);
  }

  if (body.length > 5000) {
    throw new ApiError(400, "Please shorten your message and try again.", [
      { field: "body", message: "Message must be 5000 characters or fewer." },
    ]);
  }

  return { fullName, email, body };
}

function buildHtmlEmail({
  fullName,
  email,
  body,
}: {
  fullName: string;
  email: string;
  body: string;
}) {
  const escapedName = fullName
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const escapedEmail = email
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const escapedBody = body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br />");

  return `
    <div style="font-family: Inter, Arial, sans-serif; color: #0b1220; line-height: 1.6;">
      <h2 style="margin: 0 0 16px; color: #0b2d5b;">New SVA Contact Form Message</h2>
      <p style="margin: 0 0 8px;"><strong>Name:</strong> ${escapedName}</p>
      <p style="margin: 0 0 16px;"><strong>Email:</strong> ${escapedEmail}</p>
      <div style="margin-top: 16px;">
        <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
        <div style="padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc;">
          ${escapedBody}
        </div>
      </div>
    </div>
  `.trim();
}

export const GET = withApiHandler(async () => {
  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Contact API is running.",
    data: {
      status: "ok",
      service: "contact",
      time: new Date().toISOString(),
    },
  });
}) as any;

export const POST = withApiHandler(async (req: NextRequest) => {
  const payload = (await req.json().catch(() => null)) as ContactPayload | null;

  if (!payload) {
    throw new ApiError(400, "Invalid request body.");
  }

  const { fullName, email, body } = validateContactPayload(payload);

  const clientIp = getClientIp(req);
  assertWithinRateLimit(clientIp);

  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = String(process.env.SMTP_SECURE ?? "true") === "true";

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.CONTACT_TO || "utdvets@utdallas.edu";
  const fromName = process.env.SMTP_FROM_NAME || "UT Dallas SVA Website";

  if (!user || !pass) {
    throw new ApiError(500, "Server email configuration is missing.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const subject = `New Contact Form Message from ${fullName}`;

  const text = [
    `Name: ${fullName}`,
    `Email: ${email}`,
    "",
    "Message:",
    body,
    "",
    `IP: ${clientIp}`,
  ].join("\n");

  await transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    replyTo: {
      name: fullName,
      address: email,
    },
    subject,
    text,
    html: buildHtmlEmail({ fullName, email, body }),
  });

  return sendResponse({
    statusCode: 200,
    success: true,
    message: "Message sent successfully.",
    data: {
      sent: true,
    },
  });
}) as any;