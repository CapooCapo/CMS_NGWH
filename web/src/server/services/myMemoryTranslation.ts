import "server-only";
import type { AdminTranslationInput } from "@/server/validation/adminTranslation";

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
export const MYMEMORY_TIMEOUT_MS = 8_000;

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Test-only dependency overrides keep provider tests completely offline. */
export type MyMemoryTranslationDependencies = {
  fetch?: FetchLike;
  key?: string | undefined;
  timeoutMs?: number;
};

/**
 * A deliberately opaque error: callers must not expose provider details,
 * source text, query URLs, or the API key in logs or API responses.
 */
export class TranslationUnavailableError extends Error {
  constructor() {
    super("Translation unavailable");
    this.name = "TranslationUnavailableError";
  }
}

const unavailable = (): never => {
  throw new TranslationUnavailableError();
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseSuccess(payload: unknown): string {
  if (!isRecord(payload)) throw new TranslationUnavailableError();
  if (payload.responseStatus !== 200) throw new TranslationUnavailableError();

  const responseData = payload.responseData;
  if (!isRecord(responseData) || typeof responseData.translatedText !== "string") {
    throw new TranslationUnavailableError();
  }

  const translation = responseData.translatedText.trim();
  if (!translation) throw new TranslationUnavailableError();
  return translation;
}

/**
 * Calls MyMemory directly from the server. This is intentionally a small,
 * single-provider client rather than a translation-provider abstraction.
 */
export async function translateWithMyMemory(
  input: AdminTranslationInput,
  dependencies: MyMemoryTranslationDependencies = {}
): Promise<string> {
  const key = (dependencies.key ?? process.env.MY_MEMORY_KEY ?? "").trim();
  if (!key) unavailable();

  const url = new URL(MYMEMORY_ENDPOINT);
  url.searchParams.set("q", input.text);
  url.searchParams.set("langpair", `${input.sourceLocale}|${input.targetLocale}`);
  url.searchParams.set("key", key.trim());

  const response = await (dependencies.fetch ?? fetch)(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(dependencies.timeoutMs ?? MYMEMORY_TIMEOUT_MS),
  }).catch(() => unavailable());

  if (!response.ok) unavailable();

  const payload: unknown = await response.json().catch(() => unavailable());

  return parseSuccess(payload);
}
