"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, FormAlert } from "@/components/ui";
import { JsonFormFields } from "./JsonFormFields";
import { buildJsonFormPayload } from "./jsonFormPayload";
import type { FieldSpec } from "./fieldSpec";

export function JsonForm({ action, method = "POST", fields, submitLabel, onDone, compact = false }: { action: string; method?: "POST" | "PATCH"; fields: readonly FieldSpec[]; submitLabel: string; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const tErrors = useTranslations("errors");
  const tForm = useTranslations("admin.forms");
  const baseId = useId();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [translationResetVersion, setTranslationResetVersion] = useState(0);
  const fieldId = (name: string) => `${baseId}-${name}`;
  const errorForCode = (code: string) => {
    switch (code) {
      case "required": case "invalid": case "tooShort": case "tooLong": case "invalidEmail": case "invalidPhone": case "invalidUrl": case "invalidNumber": case "outOfRange": case "invalidChoice": case "invalidDate": case "invalidSlug": case "duplicate": case "invalidReference":
        return tErrors(code);
      case "headCoachManaged": return tForm("headCoachManaged");
      default: return tForm("errorSave");
    }
  };
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setErrors({}); setFormError(null);
    const formElement = event.currentTarget;
    try {
      const response = await fetch(action, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildJsonFormPayload(fields, new FormData(formElement))) });
      if (response.ok) {
        formElement.reset();
        setTranslationResetVersion((version) => version + 1);
        onDone?.(); router.refresh(); return;
      }
      const data = (await response.json().catch(() => ({}))) as { fields?: Record<string, string>; error?: string };
      if (data.fields) setErrors(data.fields);
      else if (data.error === "forbidden") setFormError(tForm("errorForbidden"));
      else if (data.error) setFormError(errorForCode(data.error));
      else setFormError(tForm("errorSave"));
    } catch { setFormError(tForm("errorSave")); }
    finally { setPending(false); }
  }
  return <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
    {formError && <FormAlert title={formError} />}
    <div className={compact ? "flex flex-wrap items-end gap-3" : "grid gap-4 sm:grid-cols-2"}>
      <JsonFormFields fields={fields} fieldId={fieldId} errors={errors} errorForCode={errorForCode} compact={compact} translationResetVersion={translationResetVersion} urlPlaceholder={tForm("urlPlaceholder")} />
      {compact && <Button type="submit" loading={pending} loadingLabel={tForm("loadingSaving")}>{submitLabel}</Button>}
    </div>
    {!compact && <div><Button type="submit" loading={pending} loadingLabel={tForm("loadingSaving")}>{submitLabel}</Button></div>}
  </form>;
}

export { Disclosure } from "./Disclosure";
export type { FieldSpec } from "./fieldSpec";
