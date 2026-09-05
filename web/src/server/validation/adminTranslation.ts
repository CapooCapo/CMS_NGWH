import "server-only";
import { type FieldErrors, ValidationError } from "./validate";

/** The only language directions supported by the admin translation tool. */
export const TRANSLATION_LOCALES = ["vi", "en"] as const;

export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];

/** MyMemory's documented maximum UTF-8 source-segment size. */
export const MYMEMORY_MAX_SOURCE_BYTES = 500;

export type AdminTranslationInput = {
  text: string;
  sourceLocale: TranslationLocale;
  targetLocale: TranslationLocale;
};

const utf8Encoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength;
}

export function isTranslationLocale(value: unknown): value is TranslationLocale {
  return (
    typeof value === "string" &&
    (TRANSLATION_LOCALES as readonly string[]).includes(value)
  );
}

function parseLocale(
  value: unknown,
  field: "sourceLocale" | "targetLocale",
  errors: FieldErrors
): TranslationLocale | null {
  if (value === undefined || value === null) {
    errors[field] = "required";
    return null;
  }
  if (typeof value !== "string") {
    errors[field] = "invalidChoice";
    return null;
  }

  const locale = value.trim();
  if (!locale) {
    errors[field] = "required";
    return null;
  }
  if (!isTranslationLocale(locale)) {
    errors[field] = "invalidChoice";
    return null;
  }
  return locale;
}

/**
 * Parses the small, deliberately fixed translation request shape. The byte
 * limit is enforced here rather than in the client so it cannot be bypassed
 * by a handcrafted request and MyMemory never receives an oversized segment.
 */
export function parseAdminTranslation(
  data: Record<string, unknown>
): AdminTranslationInput {
  const errors: FieldErrors = {};
  const rawText = data.text;
  let text: string | null = null;

  if (rawText === undefined || rawText === null) {
    errors.text = "required";
  } else if (typeof rawText !== "string") {
    errors.text = "invalid";
  } else {
    text = rawText.trim();
    if (!text) {
      errors.text = "required";
      text = null;
    } else if (utf8ByteLength(text) > MYMEMORY_MAX_SOURCE_BYTES) {
      errors.text = "tooLong";
      text = null;
    }
  }

  const sourceLocale = parseLocale(data.sourceLocale, "sourceLocale", errors);
  const targetLocale = parseLocale(data.targetLocale, "targetLocale", errors);
  if (sourceLocale && targetLocale && sourceLocale === targetLocale) {
    errors.targetLocale = "sameLocale";
  }

  if (!text || !sourceLocale || !targetLocale || Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }

  return { text, sourceLocale, targetLocale };
}
