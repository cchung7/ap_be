import { NextResponse } from "next/server";
import { normalizeError } from "./handleError";

export function withApiHandler(
  fn: () => Promise<NextResponse>
): () => Promise<NextResponse> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      const { statusCode, message, errorSources, errorDetails } =
        normalizeError(err);

      return NextResponse.json(
        {
          success: false,
          message,
          errorSources,
          err: errorDetails,
          stack: process.env.NODE_ENV === "development"
            ? (errorDetails as any)?.stack ?? null
            : null,
        },
        { status: statusCode }
      );
    }
  };
}