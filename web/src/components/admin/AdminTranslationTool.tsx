"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, textareaClass } from "@/components/ui";
import { targetHasTranslationContent } from "./translationState";
import type { TranslationLocale } from "./translation";
import type { LocalizedPairSpec, LocalizedPairValues } from "./translationTypes";
import { useAdminTranslation } from "./useAdminTranslation";

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
  sourceLocale?: TranslationLocale;
  sourceText?: string;
  hideSourceInput?: boolean;
}) {
  const t = useTranslations("admin.translation");
  const toolId = useId();
  const translation = useAdminTranslation({ values, controlledSourceLocale, controlledSourceText });
  const sourceField = pair[translation.sourceLocale];
  const targetField = pair[translation.targetLocale];

  function writeTarget() {
    onApply(translation.targetLocale, translation.state.resultText);
    translation.dismissReplaceConfirmation();
  }
  function applyResult() {
    if (!translation.state.resultText.trim()) return;
    if (targetHasTranslationContent(values[translation.targetLocale])) {
      translation.showReplaceConfirmation();
      return;
    }
    writeTarget();
  }

  return (
    <section aria-label={t("translate")} className="sm:col-span-2 rounded-[var(--radius-lg)] border border-border bg-surface-sunken/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-sm)]">
          <p><span className="font-semibold">{t("sourceLocale")}:</span> {translation.sourceLocale.toUpperCase()}</p>
          <p><span className="font-semibold">{t("targetLocale")}:</span> {translation.targetLocale.toUpperCase()}</p>
        </div>
        {!controlledSourceLocale && <Button type="button" tone="outline" size="sm" onClick={translation.swapLocales}>{t("swap")}</Button>}
      </div>
      <div className={`mt-4 grid gap-4 ${hideSourceInput ? "" : "lg:grid-cols-2"}`}>
        {!hideSourceInput && <Field id={`${toolId}-source`} label={t("sourceLabel")} hint={t("sourceHint")}>{(field) => <textarea {...field} value={translation.sourceText} onChange={(event) => translation.changeSourceText(event.target.value)} rows={sourceField.type === "textarea" ? sourceField.rows ?? 5 : 4} placeholder={t("sourcePlaceholder")} className={textareaClass} />}</Field>}
        <Field id={`${toolId}-result`} label={t("resultLabel")}>{(field) => <textarea {...field} value={translation.state.resultText} readOnly={hideSourceInput} onChange={hideSourceInput ? undefined : (event) => translation.changeResultText(event.target.value)} rows={targetField.type === "textarea" ? targetField.rows ?? 5 : 4} placeholder={t("resultPlaceholder")} className={textareaClass} />}</Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!hideSourceInput && <Button type="button" tone="outline" size="sm" onClick={translation.loadSourceField}>{t("loadSource")}</Button>}
        <Button type="button" size="sm" loading={translation.state.pending} loadingLabel={t("translating")} disabled={!translation.canTranslate} onClick={translation.translate}>{t("translate")}</Button>
        <Button type="button" tone="outline" size="sm" disabled={!translation.state.resultText.trim() || translation.state.pending} onClick={applyResult}>{t("applyResult")}</Button>
      </div>
      {translation.state.error && <p role="alert" className="mt-3 text-[length:var(--text-sm)] font-semibold text-danger-text">{translation.state.error}</p>}
      {translation.state.confirmReplace && <div role="alertdialog" aria-labelledby={`${toolId}-replace-title`} className="mt-3 rounded-[var(--radius-md)] border border-warning/45 bg-warning/[0.08] p-3">
        <p id={`${toolId}-replace-title`} className="font-semibold">{t("replaceTitle")}</p>
        <p className="mt-1 text-[length:var(--text-sm)] text-muted">{t("replaceBody")}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={writeTarget}>{t("replace")}</Button><Button type="button" tone="outline" size="sm" onClick={translation.dismissReplaceConfirmation}>{t("cancel")}</Button></div>
      </div>}
    </section>
  );
}

export type { LocalizedPairInputSpec, LocalizedPairSpec, LocalizedSingleSpec } from "./translationTypes";
