import nodemailer from "nodemailer";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for email delivery.`);
  }

  return value;
}

function getSmtpSecure() {
  return String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
}

function getSmtpPort() {
  const raw = process.env.SMTP_PORT || "587";
  const port = Number(raw);

  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT must be a valid number.");
  }

  return port;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const host = getRequiredEnv("SMTP_HOST");
  const port = getSmtpPort();
  const secure = getSmtpSecure();
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");
  const from = process.env.SMTP_FROM || user;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}