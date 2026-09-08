import "server-only";

/**
 * Minimal server-side validation helpers.
 *
 * Deliberately hand-rolled rather than pulling in a schema library: the project
 * convention is to avoid adding dependencies that duplicate a small amount of
 * local code, and every rule here is a few lines. Field errors are returned as
 * a flat `Record<field, messageKey>` so route handlers can answer with a stable
 * JSON shape and the client can localise the message.
 */
export type FieldErrors = Record<string, string>;

export class ValidationError extends Error {
  // Declared and assigned explicitly rather than as a TypeScript parameter
  // property, so the file runs under Node's type-stripping in the test runner.
  readonly errors: FieldErrors;

  constructor(errors: FieldErrors) {
    super("Validation failed");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive on purpose: international formats vary and over-strict phone
// validation rejects legitimate numbers.
const PHONE_RE = /^[+()\-.\s0-9]{6,32}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class Validator {
  readonly errors: FieldErrors = {};
  private readonly data: Record<string, unknown>;

  constructor(data: Record<string, unknown>) {
    this.data = data;
  }

  private raw(field: string): unknown {
    return this.data[field];
  }

  private fail(field: string, code: string): void {
    // Keep the first error per field: the earliest rule is the most specific.
    if (!(field in this.errors)) this.errors[field] = code;
  }

  /** Rejects payload keys that are not part of this endpoint's contract. */
  only(fields: readonly string[]): void {
    for (const field of Object.keys(this.data)) {
      if (!fields.includes(field)) this.fail(field, "unexpected");
    }
  }

  /** Bounded homogeneous array, for batch endpoints before data reaches a service. */
  array(field: string, { required = false, max = 100 } = {}): unknown[] | null {
    const value = this.raw(field);
    if (value === undefined || value === null) {
      if (required) this.fail(field, "required");
      return null;
    }
    if (!Array.isArray(value)) {
      this.fail(field, "invalid");
      return null;
    }
    if (value.length > max) {
      this.fail(field, "tooLong");
      return null;
    }
    return value;
  }

  /** Trimmed string. `max` guards against unbounded payloads reaching the DB. */
  string(
    field: string,
    { required = false, min = 0, max = 5000 } = {}
  ): string | null {
    const value = this.raw(field);
    if (value === undefined || value === null || value === "") {
      if (required) this.fail(field, "required");
      return null;
    }
    if (typeof value !== "string") {
      this.fail(field, "invalid");
      return null;
    }
    const trimmed = value.trim();
    if (trimmed === "") {
      if (required) this.fail(field, "required");
      return null;
    }
    if (trimmed.length < min) {
      this.fail(field, "tooShort");
      return null;
    }
    if (trimmed.length > max) {
      this.fail(field, "tooLong");
      return null;
    }
    return trimmed;
  }

  email(field: string, { required = false } = {}): string | null {
    const value = this.string(field, { required, max: 254 });
    if (value === null) return null;
    if (!EMAIL_RE.test(value)) {
      this.fail(field, "invalidEmail");
      return null;
    }
    return value.toLowerCase();
  }

  phone(field: string, { required = false } = {}): string | null {
    const value = this.string(field, { required, max: 32 });
    if (value === null) return null;
    if (!PHONE_RE.test(value)) {
      this.fail(field, "invalidPhone");
      return null;
    }
    return value;
  }

  slug(field: string, { required = false } = {}): string | null {
    const value = this.string(field, { required, max: 120 });
    if (value === null) return null;
    if (!SLUG_RE.test(value)) {
      this.fail(field, "invalidSlug");
      return null;
    }
    return value;
  }

  url(field: string, { required = false } = {}): string | null {
    const value = this.string(field, { required, max: 500 });
    if (value === null) return null;
    try {
      const parsed = new URL(value);
      // Block javascript:/data: and friends — these end up in href attributes.
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        this.fail(field, "invalidUrl");
        return null;
      }
      return parsed.toString();
    } catch {
      this.fail(field, "invalidUrl");
      return null;
    }
  }

  integer(
    field: string,
    { required = false, min = -2147483648, max = 2147483647 } = {}
  ): number | null {
    const value = this.raw(field);
    if (value === undefined || value === null || value === "") {
      if (required) this.fail(field, "required");
      return null;
    }
    const parsed = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isInteger(parsed)) {
      this.fail(field, "invalidNumber");
      return null;
    }
    if (parsed < min || parsed > max) {
      this.fail(field, "outOfRange");
      return null;
    }
    return parsed;
  }

  /** One of `allowed`, else `invalidChoice`. */
  enum<T extends string>(
    field: string,
    allowed: readonly T[],
    { required = false } = {}
  ): T | null {
    const value = this.string(field, { required, max: 64 });
    if (value === null) return null;
    if (!(allowed as readonly string[]).includes(value)) {
      this.fail(field, "invalidChoice");
      return null;
    }
    return value as T;
  }

  /** ISO date-time; returns a `Date`. */
  dateTime(field: string, { required = false } = {}): Date | null {
    const value = this.string(field, { required, max: 40 });
    if (value === null) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.fail(field, "invalidDate");
      return null;
    }
    return parsed;
  }

  get valid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  /** Throws `ValidationError` unless every rule passed. */
  assert(): void {
    if (!this.valid) throw new ValidationError(this.errors);
  }
}

/** Reads a JSON body defensively — a malformed body is a validation error. */
export async function readJson(
  request: Request
): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError({ _: "invalidBody" });
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError({ _: "invalidBody" });
  }
}
