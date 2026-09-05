"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { Button, Field, controlClass, textareaClass } from "@/components/ui";
import {
  isSourceTextWithinTranslationLimit,
  type TranslationLocale,
} from "./translation";
import {
  canStartTranslation,
  createTranslationToolState,
  initialLocalizedSourceLocale,
  otherTranslationLocale,
  setLocalizedValue,
  targetHasTranslationContent,
  translationToolReducer,
} from "./translationState";

export type LocalizedPairInputSpec = {
  /** Existing API payload field name; this is never renamed by the tool. */
  name: string;
  label: string;
  type?: "text" | "textarea";
  required?: boolean;
  defaultValue?: string | null;
  hint?: string;
  rows?: number;
};

/**
 * Declarative pair consumed by JsonForm. Keeping this data-only makes the
 * translation feature opt-in, so non-admin JsonForm callers retain their
 * normal single-field controls and payload shape.
 */
export type LocalizedPairSpec = {
  type: "localizedPair";
  en: LocalizedPairInputSpec;
  vi: LocalizedPairInputSpec;
  colSpan?: 1 | 2;
};

/**
 * One logical localized value. The locale-specific names remain hidden form
 * transport fields so existing admin APIs and PostgreSQL columns stay intact.
 */
export type LocalizedSingleSpec = {
  type: "localizedSingle";
  label: string;
  enName: string;
  viName: string;
  defaultEn?: string | null;
  defaultVi?: string | null;
  hint?: string;
  rows?: number;
  colSpan?: 1 | 2;
  sourceLanguageLabel: string;
  englishLabel: string;
  vietnameseLabel: string;
};

type LocalizedPairValues = Record<TranslationLocale, string>;

export function AdminTranslationTool({
  pair,
  values,
  onApply,
  sourceLocale: controlledSourceLocale,
  sourceText: controlledSourceText,
  hideSourceInput = false,
}: {
  pair: LocalizedPairSpec;
  values: LocalizedPairValues;
  onApply: (locale: TranslationLocale, value: string) => void;
  /** Locks translation to a single logical field's original language. */
  sourceLocale?: TranslationLocale;
  /** Current original-field value; changes invalidate an in-flight request. */
  sourceText?: string;
  /** The caller already renders the only editable source field. */
  hideSourceInput?: boolean;
}) {
  const t = useTranslations("admin.translation");
  const activeLocale = useLocale();
  const toolId = useId();
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

  function invalidateRequest(): number {
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    controllerRef.current = null;
    return requestVersion;
  }

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (localeRef.current === activeLocale) return;

    localeRef.current = activeLocale;
    const requestVersion = invalidateRequest();
    // The site language can change without navigating or remounting this
    // client form. Clear only transient provider state; paired field values
    // remain in LocalizedPairFields and therefore preserve unsaved edits.
    dispatch({ type: "requestInvalidated", requestVersion });
  }, [activeLocale]);

  useEffect(() => {
    if (!controlledSourceLocale || controlledSourceText === undefined) return;
    const requestVersion = invalidateRequest();
    dispatch({
      type: "resetWorkspace",
      requestVersion,
      sourceLocale: controlledSourceLocale,
      sourceText: controlledSourceText,
    });
  }, [controlledSourceLocale, controlledSourceText]);

  function loadSourceField() {
    const requestVersion = invalidateRequest();
    dispatch({
      type: "resetWorkspace",
      requestVersion,
      sourceLocale,
      sourceText: values[sourceLocale],
    });
  }

  function swapLocales() {
    if (controlledSourceLocale) return;
    const nextSource = targetLocale;
    const requestVersion = invalidateRequest();
    // A result belongs to the previous destination. Resetting the workspace
    // prevents it being applied to the other stored field after a direction
    // swap, while `values` retain both original form fields.
    dispatch({
      type: "resetWorkspace",
      requestVersion,
      sourceLocale: nextSource,
      sourceText: values[nextSource],
    });
  }

  async function translate() {
    const text = sourceText.trim();
    const requestVersion = invalidateRequest();
    dispatch({ type: "requestStarted", requestVersion });

    if (!text) {
      dispatch({ type: "requestFailed", requestVersion, error: t("noSource") });
      return;
    }
    if (!isSourceTextWithinTranslationLimit(text)) {
      dispatch({
        type: "requestFailed",
        requestVersion,
        error: `${t("tooLong")} ${t("tooLongHint")}`,
      });
      return;
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
      const data = (await response.json().catch(() => null)) as
        | { translation?: unknown; error?: string; fields?: Record<string, string> }
        | null;

      if (requestVersion !== requestVersionRef.current || controller.signal.aborted) return;

      if (!response.ok || typeof data?.translation !== "string" || !data.translation.trim()) {
        if (data?.fields?.text === "tooLong") {
          dispatch({
            type: "requestFailed",
            requestVersion,
            error: `${t("tooLong")} ${t("tooLongHint")}`,
          });
        } else if (data?.fields?.text === "required") {
          dispatch({ type: "requestFailed", requestVersion, error: t("noSource") });
        } else if (data?.fields?.targetLocale === "sameLocale") {
          dispatch({ type: "requestFailed", requestVersion, error: t("sameLocale") });
        } else {
          dispatch({
            type: "requestFailed",
            requestVersion,
            error: data?.error === "translationUnavailable" ? t("unavailable") : t("requestFailed"),
          });
        }
        return;
      }

      dispatch({ type: "requestSucceeded", requestVersion, resultText: data.translation });
    } catch (caught) {
      if (requestVersion !== requestVersionRef.current || controller.signal.aborted) return;
      // Browser fetch exposes AbortError for deliberate invalidation; every
      // other transport failure is deliberately opaque to the admin.
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        dispatch({ type: "requestFailed", requestVersion, error: t("unavailable") });
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        controllerRef.current = null;
      }
    }
  }

  function writeTarget() {
    onApply(targetLocale, state.resultText);
    dispatch({ type: "dismissReplaceConfirmation" });
  }

  function applyResult() {
    if (!state.resultText.trim()) return;
    const currentTarget = values[targetLocale];
    if (targetHasTranslationContent(currentTarget)) {
      dispatch({ type: "showReplaceConfirmation" });
      return;
    }
    writeTarget();
  }

  const sourceField = pair[sourceLocale];
  const targetField = pair[targetLocale];

  return (
    <section
      aria-label={t("translate")}
      className="sm:col-span-2 rounded-[var(--radius-lg)] border border-border bg-surface-sunken/35 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-sm)]">
          <p>
            <span className="font-semibold">{t("sourceLocale")}:</span> {sourceLocale.toUpperCase()}
          </p>
          <p>
            <span className="font-semibold">{t("targetLocale")}:</span> {targetLocale.toUpperCase()}
          </p>
        </div>
        {!controlledSourceLocale && <Button type="button" tone="outline" size="sm" onClick={swapLocales}>{t("swap")}</Button>}
      </div>

      <div className={`mt-4 grid gap-4 ${hideSourceInput ? "" : "lg:grid-cols-2"}`}>
        {!hideSourceInput && <Field id={`${toolId}-source`} label={t("sourceLabel")} hint={t("sourceHint")}>
          {(field) => (
            <textarea
              {...field}
              value={sourceText}
              onChange={(event) => {
                const requestVersion = invalidateRequest();
                // A provider result is only valid for the exact source text
                // it was generated from. Keep a manually edited result from
                // being accidentally applied after the source changes.
                dispatch({
                  type: "sourceChanged",
                  requestVersion,
                  sourceText: event.target.value,
                });
              }}
              rows={sourceField.type === "textarea" ? sourceField.rows ?? 5 : 4}
              placeholder={t("sourcePlaceholder")}
              className={textareaClass}
            />
          )}
        </Field>}
        <Field id={`${toolId}-result`} label={t("resultLabel")}>
          {(field) => (
            <textarea
              {...field}
              value={state.resultText}
              readOnly={hideSourceInput}
              onChange={hideSourceInput ? undefined : (event) => {
                const requestVersion = invalidateRequest();
                dispatch({
                  type: "resultChanged",
                  requestVersion,
                  resultText: event.target.value,
                });
              }}
              rows={targetField.type === "textarea" ? targetField.rows ?? 5 : 4}
              placeholder={t("resultPlaceholder")}
              className={textareaClass}
            />
          )}
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!hideSourceInput && <Button type="button" tone="outline" size="sm" onClick={loadSourceField}>{t("loadSource")}</Button>}
        <Button
          type="button"
          size="sm"
          loading={state.pending}
          loadingLabel={t("translating")}
          disabled={!canStartTranslation(state)}
          onClick={translate}
        >
          {t("translate")}
        </Button>
        <Button
          type="button"
          tone="outline"
          size="sm"
          disabled={!state.resultText.trim() || state.pending}
          onClick={applyResult}
        >
          {t("applyResult")}
        </Button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-[length:var(--text-sm)] font-semibold text-danger-text">
          {state.error}
        </p>
      )}

      {state.confirmReplace && (
        <div
          role="alertdialog"
          aria-labelledby={`${toolId}-replace-title`}
          className="mt-3 rounded-[var(--radius-md)] border border-warning/45 bg-warning/[0.08] p-3"
        >
          <p id={`${toolId}-replace-title`} className="font-semibold">
            {t("replaceTitle")}
          </p>
          <p className="mt-1 text-[length:var(--text-sm)] text-muted">{t("replaceBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={writeTarget}>
              {t("replace")}
            </Button>
            <Button
              type="button"
              tone="outline"
              size="sm"
              onClick={() => dispatch({ type: "dismissReplaceConfirmation" })}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function LocalizedPairFields({
  pair,
  fieldId,
  errors,
  errorForCode,
}: {
  pair: LocalizedPairSpec;
  fieldId: (name: string) => string;
  errors: Record<string, string>;
  errorForCode: (code: string) => string;
}) {
  const [values, setValues] = useState<LocalizedPairValues>(() => ({
    en: pair.en.defaultValue ?? "",
    vi: pair.vi.defaultValue ?? "",
  }));

  function setValue(locale: TranslationLocale, value: string) {
    setValues((current) => ({ ...current, [locale]: value }));
  }

  return (
    <div className={pair.colSpan === 2 ? "contents sm:col-span-2" : "contents"}>
      {(["en", "vi"] as const).map((locale) => {
        const field = pair[locale];
        const code = errors[field.name];
        const message = code ? errorForCode(code) : null;

        return (
          <Field
            key={field.name}
            id={fieldId(field.name)}
            label={field.label}
            required={field.required}
            hint={field.hint}
            error={message}
            className={pair.colSpan === 2 ? "sm:col-span-2" : ""}
          >
            {(fieldProps) =>
              field.type === "textarea" ? (
                <textarea
                  {...fieldProps}
                  name={field.name}
                  rows={field.rows ?? 3}
                  value={values[locale]}
                  onChange={(event) => setValue(locale, event.target.value)}
                  className={`${textareaClass} ${message ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/25" : ""}`}
                />
              ) : (
                <input
                  {...fieldProps}
                  name={field.name}
                  type="text"
                  value={values[locale]}
                  onChange={(event) => setValue(locale, event.target.value)}
                  className={`${controlClass} ${message ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/25" : ""}`}
                />
              )
            }
          </Field>
        );
      })}
      <AdminTranslationTool pair={pair} values={values} onApply={setValue} />
    </div>
  );
}

/**
 * Club achievements are one logical source value plus an optional translation.
 * The two established payload names are hidden implementation details only.
 */
export function LocalizedSingleFields({
  field,
  fieldId,
  errors,
  errorForCode,
}: {
  field: LocalizedSingleSpec;
  fieldId: (name: string) => string;
  errors: Record<string, string>;
  errorForCode: (code: string) => string;
}) {
  const activeLocale = useLocale();
  const [values, setValues] = useState<LocalizedPairValues>(() => ({
    en: field.defaultEn ?? "",
    vi: field.defaultVi ?? "",
  }));
  const [sourceLocale, setSourceLocale] = useState<TranslationLocale>(() =>
    initialLocalizedSourceLocale(
      { en: field.defaultEn ?? "", vi: field.defaultVi ?? "" },
      activeLocale
    )
  );
  const code = errors[field.enName] ?? errors[field.viName];
  const message = code ? errorForCode(code) : null;
  const pair: LocalizedPairSpec = {
    type: "localizedPair",
    en: { name: field.enName, label: "", type: "textarea", rows: field.rows },
    vi: { name: field.viName, label: "", type: "textarea", rows: field.rows },
    colSpan: field.colSpan,
  };

  function setValue(locale: TranslationLocale, value: string) {
    setValues((current) => setLocalizedValue(current, locale, value));
  }

  return (
    <div className={field.colSpan === 2 ? "contents sm:col-span-2" : "contents"}>
      <input type="hidden" name={field.enName} value={values.en} />
      <input type="hidden" name={field.viName} value={values.vi} />
      <div className={`grid gap-3 ${field.colSpan === 2 ? "sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_12rem]" : ""}`}>
        <Field
          id={fieldId("achievements")}
          label={field.label}
          hint={field.hint}
          error={message}
        >
          {(fieldProps) => (
            <textarea
              {...fieldProps}
              rows={field.rows ?? 4}
              value={values[sourceLocale]}
              onChange={(event) => setValue(sourceLocale, event.target.value)}
              className={`${textareaClass} ${message ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/25" : ""}`}
            />
          )}
        </Field>
        <Field id={fieldId("achievementSourceLocale")} label={field.sourceLanguageLabel}>
          {(fieldProps) => (
            <select
              {...fieldProps}
              value={sourceLocale}
              onChange={(event) => setSourceLocale(event.target.value as TranslationLocale)}
              className={controlClass}
            >
              <option value="vi">{field.vietnameseLabel}</option>
              <option value="en">{field.englishLabel}</option>
            </select>
          )}
        </Field>
      </div>
      <AdminTranslationTool
        pair={pair}
        values={values}
        onApply={setValue}
        sourceLocale={sourceLocale}
        sourceText={values[sourceLocale]}
        hideSourceInput
      />
    </div>
  );
}
