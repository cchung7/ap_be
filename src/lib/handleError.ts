import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError } from "./apiError";

export function parsePrismaValidationError(errorMessage: string) {
  const missingFieldsRegex = /Argument `(.+?)` is missing\./g;
  let match: RegExpExecArray | null;
  const missingFields: string[] = [];

  while ((match = missingFieldsRegex.exec(errorMessage)) !== null) {
    missingFields.push(match[1]);
  }

  const invalidValueRegex =
    /Argument `(.+?)`: Invalid value provided. Expected (.+), provided (.+)\./g;
  const invalidValues: string[] = [];

  while ((match = invalidValueRegex.exec(errorMessage)) !== null) {
    const field = match[1];
    const expectedType = match[2];
    const providedValue = match[3];
    invalidValues.push(
      `${field}: Expected ${expectedType}, provided ${providedValue}`
    );
  }

  const missingFieldsMessage = missingFields.length
    ? `Missing fields: ${missingFields.join(", ")}`
    : "";
  const invalidValuesMessage = invalidValues.length
    ? `Invalid values: ${invalidValues.join("; ")}`
    : "";

  return `${missingFieldsMessage}${
    missingFieldsMessage && invalidValuesMessage ? "; " : ""
  }${invalidValuesMessage}`;
}

export function handleZodError(err: ZodError) {
  const errorSources = err.issues.map((issue) => ({
    path: issue.path[issue.path.length - 1],
    message: issue.message,
  }));

  return {
    statusCode: 400,
    message: "Validation Error",
    errorSources,
  };
}

export function normalizeError(err: unknown) {
  // Default
  let statusCode = 500;
  let message = "Something went wrong!";
  let errorSources: any[] = [];
  let errorDetails: any = null;

  // Zod
  if (err instanceof ZodError) {
    const z = handleZodError(err);
    statusCode = z.statusCode;
    message = z.message;
    errorSources = z.errorSources;
    return { statusCode, message, errorSources, errorDetails: err };
  }

  // ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ type: "ApiError", details: err.errorDetails ?? err.message }];
    return { statusCode, message, errorSources, errorDetails: err };
  }

  // Prisma known buckets
  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = parsePrismaValidationError(err.message);
    errorSources = ["Prisma Client Validation Error"];
    return { statusCode, message, errorSources, errorDetails: err };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 500;
    message =
      "Failed to initialize Prisma Client. Check database connection or Prisma configuration.";
    errorSources = ["Prisma Client Initialization Error"];
    return { statusCode, message, errorSources, errorDetails: err };
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    statusCode = 500;
    message = "A critical error occurred in the Prisma engine.";
    errorSources = ["Prisma Client Rust Panic Error"];
    return { statusCode, message, errorSources, errorDetails: err };
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = "An unknown error occurred while processing the request.";
    errorSources = ["Prisma Client Unknown Request Error"];
    return { statusCode, message, errorSources, errorDetails: err };
  }

  // Generic JS errors
  if (err instanceof Error) {
    message = err.message || message;
    errorSources = [err.name || "Error"];
    errorDetails = err;
  } else {
    errorSources = ["Unknown Error"];
    errorDetails = err;
  }

  return { statusCode, message, errorSources, errorDetails };
}