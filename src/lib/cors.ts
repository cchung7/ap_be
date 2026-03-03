// CORS Helper
import { NextRequest, NextResponse } from "next/server";

function parseOrigins(raw: string | undefined) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function withCors(req: NextRequest, res: NextResponse) {
  const allowed = parseOrigins(process.env.CORS_ORIGIN);
  const origin = req.headers.get("origin");

  if (!origin) return res;

  if (allowed.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin"); // critical when reflecting origin
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
  }

  return res;
}

export function corsPreflight(req: NextRequest) {
  // Reply to OPTIONS preflight
  const res = new NextResponse(null, { status: 204 });
  return withCors(req, res);
}