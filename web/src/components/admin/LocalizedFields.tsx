import { useLocale } from "next-intl";
import { useState } from "react";
import { Field, controlClass, textareaClass } from "@/components/ui";
import { AdminTranslationTool } from "./AdminTranslationTool";
import type { TranslationLocale } from "./translation";
import { initialLocalizedSourceLocale, setLocalizedValue } from "./translationState";
import type { LocalizedPairSpec, LocalizedPairValues, LocalizedSingleSpec } from "./translationTypes";

type CommonProps = { fieldId: (name: string) => string; errors: Record<string, string>; errorForCode: (code: string) => string };

export function LocalizedPairFields({ pair, fieldId, errors, errorForCode }: { pair: LocalizedPairSpec } & CommonProps) {
  const [values, setValues] = useState<LocalizedPairValues>(() => ({ en: pair.en.defaultValue ?? "", vi: pair.vi.defaultValue ?? "" }));
  const setValue = (locale: TranslationLocale, value: string) => setValues((current) => ({ ...current, [locale]: value }));
  return <div className={pair.colSpan === 2 ? "contents sm:col-span-2" : "contents"}>{(["en", "vi"] as const).map((locale) => {
    const field = pair[locale];
    const message = errors[field.name] ? errorForCode(errors[field.name]) : null;
    const invalid = message ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/25" : "";
    return <Field key={field.name} id={fieldId(field.name)} label={field.label} required={field.required} hint={field.hint} error={message} className={pair.colSpan === 2 ? "sm:col-span-2" : ""}>{(fieldProps) => field.type === "textarea" ? <textarea {...fieldProps} name={field.name} rows={field.rows ?? 3} value={values[locale]} onChange={(event) => setValue(locale, event.target.value)} className={`${textareaClass} ${invalid}`} /> : <input {...fieldProps} name={field.name} type="text" value={values[locale]} onChange={(event) => setValue(locale, event.target.value)} className={`${controlClass} ${invalid}`} />}</Field>;
  })}<AdminTranslationTool pair={pair} values={values} onApply={setValue} /></div>;
}

export function LocalizedSingleFields({ field, fieldId, errors, errorForCode }: { field: LocalizedSingleSpec } & CommonProps) {
  const activeLocale = useLocale();
  const [values, setValues] = useState<LocalizedPairValues>(() => ({ en: field.defaultEn ?? "", vi: field.defaultVi ?? "" }));
  const [sourceLocale, setSourceLocale] = useState<TranslationLocale>(() => initialLocalizedSourceLocale(values, activeLocale));
  const message = errors[field.enName] ?? errors[field.viName] ? errorForCode(errors[field.enName] ?? errors[field.viName]) : null;
  const pair: LocalizedPairSpec = { type: "localizedPair", en: { name: field.enName, label: "", type: "textarea", rows: field.rows }, vi: { name: field.viName, label: "", type: "textarea", rows: field.rows }, colSpan: field.colSpan };
  const setValue = (locale: TranslationLocale, value: string) => setValues((current) => setLocalizedValue(current, locale, value));
  const invalid = message ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/25" : "";
  return <div className={field.colSpan === 2 ? "contents sm:col-span-2" : "contents"}>
    <input type="hidden" name={field.enName} value={values.en} /><input type="hidden" name={field.viName} value={values.vi} />
    <div className={`grid gap-3 ${field.colSpan === 2 ? "sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_12rem]" : ""}`}>
      <Field id={fieldId("achievements")} label={field.label} hint={field.hint} error={message}>{(fieldProps) => <textarea {...fieldProps} rows={field.rows ?? 4} value={values[sourceLocale]} onChange={(event) => setValue(sourceLocale, event.target.value)} className={`${textareaClass} ${invalid}`} />}</Field>
      <Field id={fieldId("achievementSourceLocale")} label={field.sourceLanguageLabel}>{(fieldProps) => <select {...fieldProps} value={sourceLocale} onChange={(event) => setSourceLocale(event.target.value as TranslationLocale)} className={controlClass}><option value="vi">{field.vietnameseLabel}</option><option value="en">{field.englishLabel}</option></select>}</Field>
    </div>
    <AdminTranslationTool pair={pair} values={values} onApply={setValue} sourceLocale={sourceLocale} sourceText={values[sourceLocale]} hideSourceInput />
  </div>;
}
