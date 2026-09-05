import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canStartTranslation,
  createTranslationToolState,
  initialLocalizedSourceLocale,
  otherTranslationLocale,
  setLocalizedValue,
  targetHasTranslationContent,
  translationToolReducer,
} from "../src/components/admin/translationState";

test("one logical club achievement retains its original locale while the other locale is filled", () => {
  assert.equal(initialLocalizedSourceLocale({ en: "Champions", vi: "" }, "vi"), "en");
  assert.equal(initialLocalizedSourceLocale({ en: "", vi: "Vô địch" }, "en"), "vi");
  assert.equal(initialLocalizedSourceLocale({ en: "Champions", vi: "Vô địch" }, "vi"), "vi");

  const original = { en: "The club won in 2025.", vi: "" };
  const translated = setLocalizedValue(original, "vi", "Câu lạc bộ vô địch năm 2025.");
  assert.deepEqual(translated, {
    en: "The club won in 2025.",
    vi: "Câu lạc bộ vô địch năm 2025.",
  });

  const editedOriginal = setLocalizedValue(translated, "en", "The club won the 2025 championship.");
  assert.equal(editedOriginal.en, "The club won the 2025 championship.");
  assert.equal(editedOriginal.vi, "Câu lạc bộ vô địch năm 2025.");
});

test("translation state swaps active source/target roles without changing paired values", () => {
  const initial = createTranslationToolState("vi", "Mùa giải");
  const swapped = translationToolReducer(initial, {
    type: "resetWorkspace",
    requestVersion: 1,
    sourceLocale: otherTranslationLocale(initial.sourceLocale),
    sourceText: "Season",
  });

  assert.equal(swapped.sourceLocale, "en");
  assert.equal(otherTranslationLocale(swapped.sourceLocale), "vi");
  assert.equal(swapped.sourceText, "Season");
  assert.equal(swapped.resultText, "");
});

test("translation state handles loading, provider errors, and successful results", () => {
  const initial = createTranslationToolState("en", "Season");
  const loading = translationToolReducer(initial, {
    type: "requestStarted",
    requestVersion: 4,
  });
  assert.equal(loading.pending, true);
  assert.equal(loading.error, null);
  assert.equal(canStartTranslation(loading), false);

  const failed = translationToolReducer(loading, {
    type: "requestFailed",
    requestVersion: 4,
    error: "Translation is temporarily unavailable.",
  });
  assert.equal(failed.pending, false);
  assert.equal(failed.error, "Translation is temporarily unavailable.");

  const succeeded = translationToolReducer(
    translationToolReducer(failed, { type: "requestStarted", requestVersion: 5 }),
    { type: "requestSucceeded", requestVersion: 5, resultText: "Mùa giải" }
  );
  assert.equal(succeeded.pending, false);
  assert.equal(succeeded.error, null);
  assert.equal(succeeded.resultText, "Mùa giải");
  assert.equal(canStartTranslation(succeeded), true);
});

test("a manual edit invalidates a stale result and target content requires confirmation", () => {
  const loading = translationToolReducer(createTranslationToolState("vi", "Mùa giải"), {
    type: "requestStarted",
    requestVersion: 8,
  });
  const edited = translationToolReducer(loading, {
    type: "sourceChanged",
    requestVersion: 9,
    sourceText: "Mùa giải 2026",
  });
  const staleResponse = translationToolReducer(edited, {
    type: "requestSucceeded",
    requestVersion: 8,
    resultText: "Season",
  });

  assert.equal(staleResponse.resultText, "");
  assert.equal(staleResponse.pending, false);
  assert.equal(targetHasTranslationContent(""), false);
  assert.equal(targetHasTranslationContent("Existing English name"), true);

  const confirm = translationToolReducer(staleResponse, { type: "showReplaceConfirmation" });
  assert.equal(confirm.confirmReplace, true);
  assert.equal(
    translationToolReducer(confirm, { type: "dismissReplaceConfirmation" }).confirmReplace,
    false
  );
});

test("a newer request, manual result edit, or locale change rejects prior responses", () => {
  const firstRequest = translationToolReducer(createTranslationToolState("en", "Season"), {
    type: "requestStarted",
    requestVersion: 10,
  });
  const newerRequest = translationToolReducer(firstRequest, {
    type: "requestStarted",
    requestVersion: 11,
  });
  assert.equal(
    translationToolReducer(newerRequest, {
      type: "requestSucceeded",
      requestVersion: 10,
      resultText: "Mùa giải cũ",
    }).resultText,
    ""
  );

  const manualResult = translationToolReducer(newerRequest, {
    type: "resultChanged",
    requestVersion: 12,
    resultText: "Bản dịch tự chỉnh",
  });
  assert.equal(
    translationToolReducer(manualResult, {
      type: "requestSucceeded",
      requestVersion: 11,
      resultText: "Mùa giải",
    }).resultText,
    "Bản dịch tự chỉnh"
  );

  const localeChanged = translationToolReducer(manualResult, {
    type: "requestInvalidated",
    requestVersion: 13,
  });
  assert.equal(localeChanged.pending, false);
  assert.equal(localeChanged.resultText, "");
  assert.equal(
    translationToolReducer(localeChanged, {
      type: "requestSucceeded",
      requestVersion: 12,
      resultText: "Không được áp dụng",
    }).resultText,
    ""
  );
});
