import { useLocale, useTranslations } from "next-intl";
import { useEffect, useReducer, useRef } from "react";
import { isSourceTextWithinTranslationLimit, type TranslationLocale } from "./translation";
import {
  canStartTranslation,
  createTranslationToolState,
  otherTranslationLocale,
  translationToolReducer,
} from "./translationState";
import type { LocalizedPairValues } from "./translationTypes";

export function useAdminTranslation({
  values,
  controlledSourceLocale,
  controlledSourceText,
}: {
  values: LocalizedPairValues;
  controlledSourceLocale?: TranslationLocale;
  controlledSourceText?: string;
}) {
  const t = useTranslations("admin.translation");
  const activeLocale = useLocale();
  const initialSourceLocale: TranslationLocale = controlledSourceLocale ?? (activeLocale === "en" ? "en" : "vi");
  const [state, dispatch] = useReducer(
    translationToolReducer,
    undefined,
    () => createTranslationToolState(initialSourceLocale, values[initialSourceLocale])
  );
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const localeRef = useRef(activeLocale);
  const sourceLocale = controlledSourceLocale ?? state.sourceLocale;
  const sourceText = controlledSourceText ?? state.sourceText;
  const targetLocale = otherTranslationLocale(sourceLocale);

  function invalidateRequest() {
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    controllerRef.current = null;
    return requestVersion;
  }

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (localeRef.current === activeLocale) return;
    localeRef.current = activeLocale;
    dispatch({ type: "requestInvalidated", requestVersion: invalidateRequest() });
  }, [activeLocale]);
  useEffect(() => {
    if (!controlledSourceLocale || controlledSourceText === undefined) return;
    dispatch({
      type: "resetWorkspace",
      requestVersion: invalidateRequest(),
      sourceLocale: controlledSourceLocale,
      sourceText: controlledSourceText,
    });
  }, [controlledSourceLocale, controlledSourceText]);

  function loadSourceField() {
    dispatch({ type: "resetWorkspace", requestVersion: invalidateRequest(), sourceLocale, sourceText: values[sourceLocale] });
  }
  function swapLocales() {
    if (controlledSourceLocale) return;
    const nextSource = targetLocale;
    dispatch({ type: "resetWorkspace", requestVersion: invalidateRequest(), sourceLocale: nextSource, sourceText: values[nextSource] });
  }
  function changeSourceText(nextSourceText: string) {
    dispatch({ type: "sourceChanged", requestVersion: invalidateRequest(), sourceText: nextSourceText });
  }
  function changeResultText(resultText: string) {
    dispatch({ type: "resultChanged", requestVersion: invalidateRequest(), resultText });
  }
  async function translate() {
    const text = sourceText.trim();
    const requestVersion = invalidateRequest();
    dispatch({ type: "requestStarted", requestVersion });
    if (!text) return dispatch({ type: "requestFailed", requestVersion, error: t("noSource") });
    if (!isSourceTextWithinTranslationLimit(text)) {
      return dispatch({ type: "requestFailed", requestVersion, error: `${t("tooLong")} ${t("tooLongHint")}` });
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceLocale, targetLocale }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as { translation?: unknown; error?: string; fields?: Record<string, string> } | null;
      if (requestVersion !== requestVersionRef.current || controller.signal.aborted) return;
      if (!response.ok || typeof data?.translation !== "string" || !data.translation.trim()) {
        const error =
          data?.fields?.text === "tooLong" ? `${t("tooLong")} ${t("tooLongHint")}` :
          data?.fields?.text === "required" ? t("noSource") :
          data?.fields?.targetLocale === "sameLocale" ? t("sameLocale") :
          data?.error === "translationUnavailable" ? t("unavailable") : t("requestFailed");
        dispatch({ type: "requestFailed", requestVersion, error });
        return;
      }
      dispatch({ type: "requestSucceeded", requestVersion, resultText: data.translation });
    } catch (caught) {
      if (requestVersion !== requestVersionRef.current || controller.signal.aborted) return;
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        dispatch({ type: "requestFailed", requestVersion, error: t("unavailable") });
      }
    } finally {
      if (requestVersion === requestVersionRef.current) controllerRef.current = null;
    }
  }

  return {
    canTranslate: canStartTranslation(state),
    changeResultText,
    changeSourceText,
    dismissReplaceConfirmation: () => dispatch({ type: "dismissReplaceConfirmation" }),
    loadSourceField,
    showReplaceConfirmation: () => dispatch({ type: "showReplaceConfirmation" }),
    sourceLocale,
    sourceText,
    state,
    swapLocales,
    targetLocale,
    translate,
  };
}
