import "server-only";
import { NextResponse } from "next/server";
import { ValidationError } from "@/server/validation/validate";

/**
 * Shared response helpers, so every route answers with the same JSON shape and
 * no handler leaks an internal error message to the client.
 */
export const ok = <T>(data: T, status = 200) =>
  NextResponse.json(data, { status });

export const notFound = () =>
  NextResponse.json({ error: "notFound" }, { status: 404 });

export const badRequest = (fields: Record<string, string>) =>
  NextResponse.json({ error: "validation", fields }, { status: 400 });

/**
 * Provider failures stay deliberately opaque: a translation query URL contains
 * both the admin's source text and the server-only MyMemory key.
 */
export const translationUnavailable = () =>
  NextResponse.json({ error: "translationUnavailable" }, { status: 503 });

// PostgreSQL SQLSTATE codes worth translating into a client-meaningful status.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";

/**
 * Maps a thrown error to a response: validation errors become 400 with field
 * codes, constraint violations become 409/400, and anything else is logged and
 * reported as an opaque 500.
 */
export function fail(context: string, error: unknown): NextResponse {
  if (error instanceof ValidationError) return badRequest(error.errors);

  const code = (error as { code?: string })?.code;
  if (code === UNIQUE_VIOLATION) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 });
  }
  if (code === FOREIGN_KEY_VIOLATION) {
    return NextResponse.json({ error: "invalidReference" }, { status: 409 });
  }
  if (code === CHECK_VIOLATION || code === NOT_NULL_VIOLATION) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  console.error(`${context} failed`, error);
  return NextResponse.json({ error: "server" }, { status: 500 });
}

/** Parses a positive integer route param, or null when it is not one. */
export function parseId(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
