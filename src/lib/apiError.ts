export type ErrorDetail = {
  field?: string;
  message: string;
};

export class ApiError extends Error {
  statusCode: number;
  errorDetails?: ErrorDetail[];

  constructor(
    statusCode: number,
    message: string,
    errorDetails?: ErrorDetail[] | string
  ) {
    super(message);
    this.statusCode = statusCode;

    if (errorDetails) {
      this.errorDetails =
        typeof errorDetails === "string"
          ? [{ message: errorDetails }]
          : errorDetails;
    }

    Error.captureStackTrace?.(this, this.constructor);
  }
}