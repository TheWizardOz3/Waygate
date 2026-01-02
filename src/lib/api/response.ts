// Standard API response helpers

import { NextResponse } from 'next/server';

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
    suggestedResolution?: {
      action: string;
      description: string;
      retryable: boolean;
      retryAfterMs?: number | null;
    };
  };
}

export function successResponse<T>(data: T, status = 200) {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  return NextResponse.json(response, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
) {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  return NextResponse.json(response, { status });
}
