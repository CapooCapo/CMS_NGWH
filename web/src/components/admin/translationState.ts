import type { TranslationLocale } from "./translation";

export type TranslationToolState = {
  sourceLocale: TranslationLocale;
  sourceText: string;
  resultText: string;
  pending: boolean;
  error: string | null;
  confirmReplace: boolean;
  requestVersion: number;
};

export type TranslationToolAction =
  | {
      type: "resetWorkspace";
      requestVersion: number;
      sourceLocale: TranslationLocale;
      sourceText: string;
    }
  | { type: "sourceChanged"; requestVersion: number; sourceText: string }
  | { type: "resultChanged"; requestVersion: number; resultText: string }
  | { type: "requestStarted"; requestVersion: number }
  | { type: "requestInvalidated"; requestVersion: number }
  | { type: "requestFailed"; requestVersion: number; error: string }
  | { type: "requestSucceeded"; requestVersion: number; resultText: string }
  | { type: "showReplaceConfirmation" }
  | { type: "dismissReplaceConfirmation" };

export function otherTranslationLocale(locale: TranslationLocale): TranslationLocale {
  return locale === "en" ? "vi" : "en";
}

/**
 * Existing localized columns do not record which value was authored first.
 * For a logical single field, prefer the only populated locale; for older
 * rows containing both values, begin with the language currently in use and
 * let the administrator explicitly confirm or change the source language.
 */
export function initialLocalizedSourceLocale(
  values: Record<TranslationLocale, string>,
  activeLocale: string
): TranslationLocale {
  if (values.en.trim() && !values.vi.trim()) return "en";
  if (values.vi.trim() && !values.en.trim()) return "vi";
  return activeLocale === "en" ? "en" : "vi";
}

/** Updates one locale without mutating the other, including the original. */
export function setLocalizedValue(
  values: Record<TranslationLocale, string>,
  locale: TranslationLocale,
  value: string
): Record<TranslationLocale, string> {
  return { ...values, [locale]: value };
}

export function targetHasTranslationContent(value: string): boolean {
  return Boolean(value.trim());
}

export function canStartTranslation(state: TranslationToolState): boolean {
  return !state.pending;
}

export function createTranslationToolState(
  sourceLocale: TranslationLocale,
  sourceText: string
): TranslationToolState {
  return {
    sourceLocale,
    sourceText,
    resultText: "",
    pending: false,
    error: null,
    confirmReplace: false,
    requestVersion: 0,
  };
}

/**
 * Keeps the async translation workspace deterministic. A result is accepted
 * only for the latest request version, so an older provider response cannot
 * overwrite a newer request or a manual edit.
 */
export function translationToolReducer(
  state: TranslationToolState,
  action: TranslationToolAction
): TranslationToolState {
  switch (action.type) {
    case "resetWorkspace":
      return {
        ...state,
        sourceLocale: action.sourceLocale,
        sourceText: action.sourceText,
        resultText: "",
        pending: false,
        error: null,
        confirmReplace: false,
        requestVersion: action.requestVersion,
      };
    case "sourceChanged":
      return {
        ...state,
        sourceText: action.sourceText,
        resultText: "",
        pending: false,
        error: null,
        confirmReplace: false,
        requestVersion: action.requestVersion,
      };
    case "resultChanged":
      return {
        ...state,
        resultText: action.resultText,
        pending: false,
        error: null,
        confirmReplace: false,
        requestVersion: action.requestVersion,
      };
    case "requestStarted":
      return {
        ...state,
        resultText: "",
        pending: true,
        error: null,
        confirmReplace: false,
        requestVersion: action.requestVersion,
      };
    case "requestInvalidated":
      return {
        ...state,
        resultText: "",
        pending: false,
        error: null,
        confirmReplace: false,
        requestVersion: action.requestVersion,
      };
    case "requestFailed":
      return action.requestVersion === state.requestVersion
        ? { ...state, pending: false, error: action.error }
        : state;
    case "requestSucceeded":
      return action.requestVersion === state.requestVersion
        ? {
            ...state,
            resultText: action.resultText,
            pending: false,
            error: null,
            confirmReplace: false,
          }
        : state;
    case "showReplaceConfirmation":
      return { ...state, confirmReplace: true };
    case "dismissReplaceConfirmation":
      return { ...state, confirmReplace: false };
  }
}
