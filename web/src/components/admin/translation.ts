/**
 * Browser-side guards for the privileged MyMemory translation action. The API
 * repeats this validation authoritatively; these helpers only avoid sending a
 * request we already know the provider will reject.
 */
export const MAX_TRANSLATION_SOURCE_BYTES = 500;

export const TRANSLATION_LOCALES = ["en", "vi"] as const;
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isTranslationLocale(value: string): value is TranslationLocale {
  return (TRANSLATION_LOCALES as readonly string[]).includes(value);
}

export function isSourceTextWithinTranslationLimit(value: string): boolean {
  return utf8ByteLength(value) <= MAX_TRANSLATION_SOURCE_BYTES;
}
