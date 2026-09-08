import "server-only";
import { NextResponse } from "next/server";
import { ValidationError } from "@/server/validation/validate";

export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const messages: Record<ErrorCode, string> = {
  INVALID_INPUT: "Invalid request",
  UNAUTHENTICATED: "Authentication required",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Resource not found",
  CONFLICT: "Request conflicts with current state",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  INTERNAL_ERROR: "Internal server error",
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode) {
    super(messages[code]);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(status: number, code: ErrorCode): NextResponse {
  return NextResponse.json({ error: { code, message: messages[code] } }, { status });
}

export function errorFrom(error: unknown, context: string): NextResponse {
  if (error instanceof HttpError) return errorResponse(error.status, error.code);
  if (error instanceof ValidationError) return errorResponse(400, "INVALID_INPUT");
  console.error(`${context} failed`, error);
  return errorResponse(500, "INTERNAL_ERROR");
}
