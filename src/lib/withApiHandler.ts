  import { NextResponse } from "next/server";
  import { normalizeError } from "./handleError";

  function safeErrDetails(err: unknown) {
    if (!err) return null;
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
      };
    }
    return { message: String(err) };
  }

  export function withApiHandler<TArgs extends any[]>(
    fn: (...args: TArgs) => Promise<NextResponse>
  ) {
    return async (...args: TArgs) => {
      try {
        return await fn(...args);
      } catch (err) {
        const { statusCode, message, errorSources, errorDetails } =
          normalizeError(err);

        return NextResponse.json(
          {
            success: false,
            message,
            errorSources,
            err: safeErrDetails(errorDetails),
            stack:
              process.env.NODE_ENV === "development"
                ? (errorDetails as any)?.stack ?? null
                : null,
          },
          { status: statusCode }
        );
      }
    };
  }