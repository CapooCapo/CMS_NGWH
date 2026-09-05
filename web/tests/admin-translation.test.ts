import { test } from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import {
  handleAdminTranslation,
  type AdminTranslationHandlerDependencies,
} from "../src/server/api/adminTranslation";
import type { Guarded } from "../src/server/auth/guard";
import {
  MYMEMORY_TIMEOUT_MS,
  TranslationUnavailableError,
  translateWithMyMemory,
  type FetchLike,
} from "../src/server/services/myMemoryTranslation";
import {
  MYMEMORY_MAX_SOURCE_BYTES,
  parseAdminTranslation,
  utf8ByteLength,
} from "../src/server/validation/adminTranslation";
import { ValidationError } from "../src/server/validation/validate";

const VALID_INPUT = {
  text: "Xin chào",
  sourceLocale: "vi",
  targetLocale: "en",
} as const;

function validationErrors(input: Record<string, unknown>): Record<string, string> {
  try {
    parseAdminTranslation(input);
    assert.fail("expected validation to fail");
  } catch (error) {
    assert.ok(error instanceof ValidationError);
    return error.errors;
  }
}

const allowedGuard = async (): Promise<Guarded> => ({
  ok: true,
  admin: { id: 1, username: "admin", email: null, role: "admin" },
});

function request(body: BodyInit): Request {
  return new Request("http://localhost/api/admin/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

/* ---------------------------------------------------------- validation */

test("translation input accepts both directions and trims source text", () => {
  assert.deepEqual(parseAdminTranslation({ ...VALID_INPUT, text: "  Xin chào  " }), {
    ...VALID_INPUT,
  });
  assert.deepEqual(
    parseAdminTranslation({ text: "Hello", sourceLocale: "en", targetLocale: "vi" }),
    { text: "Hello", sourceLocale: "en", targetLocale: "vi" }
  );
});

test("translation input rejects every invalid request class", () => {
  assert.equal(validationErrors({ sourceLocale: "vi", targetLocale: "en" }).text, "required");
  assert.equal(
    validationErrors({ ...VALID_INPUT, text: "   " }).text,
    "required"
  );
  assert.equal(validationErrors({ ...VALID_INPUT, text: 123 }).text, "invalid");
  assert.equal(
    validationErrors({ text: "Hello", sourceLocale: "fr", targetLocale: "en" }).sourceLocale,
    "invalidChoice"
  );
  assert.equal(
    validationErrors({ text: "Hello", targetLocale: "en" }).sourceLocale,
    "required"
  );
  assert.equal(
    validationErrors({ text: "Hello", sourceLocale: 1, targetLocale: "en" }).sourceLocale,
    "invalidChoice"
  );
  assert.equal(
    validationErrors({ text: "Hello", sourceLocale: "vi", targetLocale: "fr" }).targetLocale,
    "invalidChoice"
  );
  assert.equal(
    validationErrors({ text: "Hello", sourceLocale: "vi" }).targetLocale,
    "required"
  );
  assert.equal(
    validationErrors({ text: "Hello", sourceLocale: "vi", targetLocale: 1 }).targetLocale,
    "invalidChoice"
  );
  assert.equal(
    validationErrors({ text: "Hello", sourceLocale: "vi", targetLocale: "vi" }).targetLocale,
    "sameLocale"
  );
});

test("translation input enforces MyMemory's 500-byte UTF-8 source limit", () => {
  const atLimit = "ế".repeat(166) + "ab"; // 166 * 3 bytes + 2 ASCII bytes
  assert.equal(utf8ByteLength(atLimit), MYMEMORY_MAX_SOURCE_BYTES);
  assert.equal(parseAdminTranslation({ ...VALID_INPUT, text: atLimit }).text, atLimit);

  const overLimit = `${atLimit}x`;
  assert.equal(utf8ByteLength(overLimit), MYMEMORY_MAX_SOURCE_BYTES + 1);
  assert.equal(validationErrors({ ...VALID_INPUT, text: overLimit }).text, "tooLong");
});

/* ------------------------------------------------------------ provider */

test("MyMemory client sends exactly q, langpair, and key with no-store caching", async () => {
  const observed: { url?: URL; init?: RequestInit } = {};
  const fakeFetch: FetchLike = async (input, init) => {
    observed.url = new URL(String(input));
    observed.init = init;
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText: "  Hello  " },
    });
  };

  const translation = await translateWithMyMemory(VALID_INPUT, {
    key: "test-private-key",
    fetch: fakeFetch,
  });

  assert.equal(translation, "Hello");
  assert.ok(observed.url);
  assert.equal(observed.url.origin, "https://api.mymemory.translated.net");
  assert.equal(observed.url.pathname, "/get");
  assert.equal(observed.url.searchParams.get("q"), "Xin chào");
  assert.equal(observed.url.searchParams.get("langpair"), "vi|en");
  assert.equal(observed.url.searchParams.get("key"), "test-private-key");
  assert.deepEqual([...observed.url.searchParams.keys()].sort(), ["key", "langpair", "q"]);
  assert.equal(observed.init?.cache, "no-store");
  assert.ok(observed.init?.signal instanceof AbortSignal);
  assert.equal(MYMEMORY_TIMEOUT_MS, 8_000);
});

test("MyMemory client supports English-to-Vietnamese requests", async () => {
  let langpair: string | null = null;
  const fakeFetch: FetchLike = async (input) => {
    langpair = new URL(String(input)).searchParams.get("langpair");
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText: "Xin chào" },
    });
  };

  const translation = await translateWithMyMemory(
    { text: "Hello", sourceLocale: "en", targetLocale: "vi" },
    { key: "test-private-key", fetch: fakeFetch }
  );

  assert.equal(translation, "Xin chào");
  assert.equal(langpair, "en|vi");
});

test("MyMemory client rejects a missing key before any request", async () => {
  let called = false;
  const fakeFetch: FetchLike = async () => {
    called = true;
    return Response.json({});
  };

  await assert.rejects(
    translateWithMyMemory(VALID_INPUT, { key: "", fetch: fakeFetch }),
    TranslationUnavailableError
  );
  assert.equal(called, false);
});

test("MyMemory client aborts a provider request at the configured timeout", async () => {
  const slowFetch: FetchLike = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("missing timeout signal"));
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });

  await assert.rejects(
    translateWithMyMemory(VALID_INPUT, {
      key: "test-private-key",
      fetch: slowFetch,
      timeoutMs: 1,
    }),
    TranslationUnavailableError
  );
});

test("MyMemory client normalizes transport, HTTP, and malformed-provider failures", async () => {
  const failures: { name: string; fetch: FetchLike }[] = [
    {
      name: "transport",
      fetch: async () => {
        throw new DOMException("request timed out", "TimeoutError");
      },
    },
    {
      name: "HTTP",
      fetch: async () => new Response("upstream unavailable", { status: 502 }),
    },
    {
      name: "malformed JSON",
      fetch: async () =>
        new Response("not JSON", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
    {
      name: "provider status",
      fetch: async () => Response.json({ responseStatus: 403, responseData: {} }),
    },
    {
      name: "missing translation",
      fetch: async () => Response.json({ responseStatus: 200, responseData: {} }),
    },
    {
      name: "blank translation",
      fetch: async () =>
        Response.json({ responseStatus: 200, responseData: { translatedText: "   " } }),
    },
  ];

  for (const { name, fetch } of failures) {
    await assert.rejects(
      translateWithMyMemory(VALID_INPUT, { key: "test-private-key", fetch }),
      TranslationUnavailableError,
      name
    );
  }
});

/* ------------------------------------------------------------- handler */

test("translation handler returns guard 401 before parsing the body", async () => {
  let translated = false;
  const unauthenticated = NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const dependencies: AdminTranslationHandlerDependencies = {
    requireRole: async () => ({ ok: false, response: unauthenticated }),
    translate: async () => {
      translated = true;
      return "should not run";
    },
  };

  const response = await handleAdminTranslation(request("not json"), dependencies);
  assert.equal(response, unauthenticated);
  assert.equal(response.status, 401);
  assert.equal(translated, false);
});

test("translation handler preserves a 403 guard response", async () => {
  const forbidden = NextResponse.json({ error: "forbidden" }, { status: 403 });
  const response = await handleAdminTranslation(request("{}"), {
    requireRole: async () => ({ ok: false, response: forbidden }),
  });
  assert.equal(response, forbidden);
  assert.equal(response.status, 403);
});

test("translation handler returns field validation errors without calling the provider", async () => {
  let translated = false;
  const response = await handleAdminTranslation(request("not json"), {
    requireRole: allowedGuard,
    translate: async () => {
      translated = true;
      return "should not run";
    },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "validation",
    fields: { _: "invalidBody" },
  });
  assert.equal(translated, false);
});

test("translation handler returns a normalized success response", async () => {
  let translatedInput: unknown;
  const response = await handleAdminTranslation(
    request(JSON.stringify({ ...VALID_INPUT, text: "  Xin chào  " })),
    {
      requireRole: allowedGuard,
      translate: async (input) => {
        translatedInput = input;
        return "Hello";
      },
    }
  );

  assert.deepEqual(translatedInput, VALID_INPUT);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { translation: "Hello" });
});

test("translation handler turns every provider error into an opaque 503", async () => {
  const response = await handleAdminTranslation(request(JSON.stringify(VALID_INPUT)), {
    requireRole: allowedGuard,
    translate: async () => {
      throw new Error("https://provider.example/?key=private&q=secret");
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "translationUnavailable" });
});
