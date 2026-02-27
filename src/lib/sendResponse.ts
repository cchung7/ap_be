import { NextResponse } from "next/server";

export type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  totalPage?: number;
};

export type ApiResponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string;
  meta?: ApiMeta;
  data?: T;
  stats?: any;
};

export function sendResponse<T>(payload: ApiResponse<T>) {
  const body: ApiResponse<T> = {
    statusCode: payload.statusCode,
    success: payload.success,
    message: payload.message || "",
    meta: payload.meta,
    data: payload.data ?? ({} as T),
    stats: payload.stats ?? {},
  };

  return NextResponse.json(body, { status: payload.statusCode });
}