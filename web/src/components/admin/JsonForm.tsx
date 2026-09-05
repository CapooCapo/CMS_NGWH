"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  LocalizedPairFields,
  type LocalizedPairSpec,
  LocalizedSingleFields,
  type LocalizedSingleSpec,
} from "@/components/admin/AdminTranslationTool";
import {
  Button,
  Field,
  FormAlert,
  controlClass,
  controlInvalidClass,
  textareaClass,
} from "@/components/ui";

/**
 * Generic JSON-posting admin form.
 *
 * The admin screens all follow the same shape — a handful of typed fields, a
 * POST/PATCH to a route handler, then `router.refresh()` so the list re-reads
 * from the database. Rather than six near-identical bespoke forms, they share
 * this one and describe their fields declaratively.
 *
 * Server validation stays authoritative: field errors returned as
 * `{fields: {name: code}}` are rendered against the matching input with
 * `aria-invalid`/`aria-describedby`.
 */
export type FieldSpec =
  | {
      name: string;
      label: string;
      type?: "text" | "email" | "tel" | "url" | "number" | "date" | "datetime-local" | "password";
      required?: boolean;
      defaultValue?: string | number | null;
      hint?: string;
      min?: number;
      max?: number;
      colSpan?: 1 | 2;
    }
  | {
      name: string;
      label: string;
      type: "textarea";
      required?: boolean;
      defaultValue?: string | null;
      hint?: string;
      rows?: number;
      colSpan?: 1 | 2;
    }
  | {
      name: string;
      label: string;
      type: "select";
      required?: boolean;
      defaultValue?: string | number | null;
      options: { value: string; label: string }[];
      hint?: string;
      colSpan?: 1 | 2;
    }
  | {
      name: string;
      label: string;
      type: "checkbox";
      defaultChecked?: boolean;
      hint?: string;
      colSpan?: 1 | 2;
    }
  | {
      name: string;
      label: string;
      /** A small set of named URL inputs, submitted as one object under `name`. */
      type: "urlgroup";
      keys: readonly { key: string; label: string }[];
      defaultValue?: Record<string, string>;
      hint?: string;
      colSpan?: 1 | 2;
    }
  | LocalizedPairSpec
  | LocalizedSingleSpec;

export function JsonForm({
  action,
  method = "POST",
  fields,
  submitLabel,
  onDone,
  compact = false,
}: {
  action: string;
  method?: "POST" | "PATCH";
  fields: readonly FieldSpec[];
  submitLabel: string;
  onDone?: () => void;
  compact?: boolean;
}) {
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
      case "required":
      case "invalid":
      case "tooShort":
      case "tooLong":
      case "invalidEmail":
      case "invalidPhone":
      case "invalidUrl":
      case "invalidNumber":
      case "outOfRange":
      case "invalidChoice":
      case "invalidDate":
      case "invalidSlug":
      case "duplicate":
      case "invalidReference":
        return tErrors(code);
      case "headCoachManaged":
        return tForm("headCoachManaged");
      default:
        return tForm("errorSave");
    }
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "localizedPair") {
        for (const localizedField of [field.en, field.vi]) {
          const raw = form.get(localizedField.name);
          payload[localizedField.name] =
            typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
        }
        continue;
      }
      if (field.type === "localizedSingle") {
        for (const name of [field.enName, field.viName]) {
          const raw = form.get(name);
          payload[name] = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
        }
        continue;
      }
      if (field.type === "urlgroup") {
        const group: Record<string, string> = {};
        for (const { key } of field.keys) {
          const value = form.get(`${field.name}.${key}`);
          if (typeof value === "string" && value.trim()) group[key] = value.trim();
        }
        payload[field.name] = group;
        continue;
      }
      const raw = form.get(field.name);
      if (field.type === "checkbox") {
        payload[field.name] = raw === "on";
      } else if (field.type === "number") {
        payload[field.name] =
          typeof raw === "string" && raw.trim() !== "" ? Number(raw) : null;
      } else {
        payload[field.name] =
          typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
      }
    }

    try {
      const response = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        (event.target as HTMLFormElement).reset();
        setTranslationResetVersion((version) => version + 1);
        onDone?.();
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        fields?: Record<string, string>;
        error?: string;
      };
      if (data.fields) setErrors(data.fields);
      else if (data.error === "forbidden") setFormError(tForm("errorForbidden"));
      else if (data.error) setFormError(errorForCode(data.error));
      else setFormError(tForm("errorSave"));
    } catch {
      setFormError(tForm("errorSave"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <FormAlert title={formError} />}

      <div
        className={
          compact ? "flex flex-wrap items-end gap-3" : "grid gap-4 sm:grid-cols-2"
        }
      >
        {fields.map((field) => {
          if (field.type === "localizedPair") {
            return (
              <LocalizedPairFields
                key={`${field.en.name}-${field.vi.name}-${field.en.defaultValue ?? ""}-${field.vi.defaultValue ?? ""}-${translationResetVersion}`}
                pair={field}
                fieldId={fieldId}
                errors={errors}
                errorForCode={errorForCode}
              />
            );
          }

          if (field.type === "localizedSingle") {
            return (
              <LocalizedSingleFields
                key={`${field.enName}-${field.viName}-${field.defaultEn ?? ""}-${field.defaultVi ?? ""}-${translationResetVersion}`}
                field={field}
                fieldId={fieldId}
                errors={errors}
                errorForCode={errorForCode}
              />
            );
          }

          const code = errors[field.name];
          const message = code ? errorForCode(code) : null;
          const invalid = message ? controlInvalidClass : "";

          if (field.type === "checkbox") {
            return (
              <label
                key={field.name}
                className={`flex cursor-pointer items-center gap-2.5 text-[length:var(--text-sm)] font-semibold ${
                  field.colSpan === 2 ? "sm:col-span-2" : ""
                }`}
              >
                <input
                  type="checkbox"
                  id={fieldId(field.name)}
                  name={field.name}
                  defaultChecked={field.defaultChecked}
                  className="h-4 w-4 rounded-[2px] border-border-strong accent-[var(--brand)]"
                />
                {field.label}
                {field.hint && (
                  <span className="text-[length:var(--text-xs)] font-normal text-muted">
                    {field.hint}
                  </span>
                )}
              </label>
            );
          }

          if (field.type === "urlgroup") {
            return (
              <div
                key={field.name}
                className={`flex flex-col gap-3 ${field.colSpan === 2 ? "sm:col-span-2" : ""}`}
              >
                <span className="text-[length:var(--text-sm)] font-semibold">
                  {field.label}
                  {field.hint && (
                    <span className="ml-2 text-[length:var(--text-xs)] font-normal text-muted">
                      {field.hint}
                    </span>
                  )}
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field.keys.map(({ key, label }) => (
                    <Field
                      key={key}
                      id={fieldId(`${field.name}.${key}`)}
                      label={label}
                    >
                      {(f) => (
                        <input
                          {...f}
                          name={`${field.name}.${key}`}
                          type="url"
                          defaultValue={field.defaultValue?.[key] ?? ""}
                          placeholder={tForm("urlPlaceholder")}
                          className={controlClass}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Field
              key={field.name}
              id={fieldId(field.name)}
              label={field.label}
              required={"required" in field ? field.required : false}
              hint={field.hint}
              error={message}
              className={[
                field.colSpan === 2 ? "sm:col-span-2" : "",
                compact ? "min-w-40 flex-1" : "",
              ].join(" ")}
            >
              {(f) =>
                field.type === "textarea" ? (
                  <textarea
                    {...f}
                    name={field.name}
                    rows={field.rows ?? 3}
                    defaultValue={field.defaultValue ?? ""}
                    className={`${textareaClass} ${invalid}`}
                  />
                ) : field.type === "select" ? (
                  <select
                    {...f}
                    name={field.name}
                    defaultValue={field.defaultValue ?? ""}
                    className={`${controlClass} ${invalid}`}
                  >
                    {!field.required && <option value="">—</option>}
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...f}
                    name={field.name}
                    type={field.type ?? "text"}
                    defaultValue={field.defaultValue ?? ""}
                    min={field.min}
                    max={field.max}
                    className={`${controlClass} ${invalid}`}
                  />
                )
              }
            </Field>
          );
        })}

        {compact && (
          <Button type="submit" loading={pending} loadingLabel={tForm("loadingSaving")}>
            {submitLabel}
          </Button>
        )}
      </div>

      {!compact && (
        <div>
          <Button type="submit" loading={pending} loadingLabel={tForm("loadingSaving")}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

/** Collapsible wrapper so "create" forms do not dominate a list page. */
export function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-[length:var(--text-sm)] font-semibold transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken/70"
      >
        {label}
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-[var(--motion-base)] ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && <div className="border-t border-border bg-surface-sunken/25 p-5 sm:p-6">{children}</div>}
    </div>
  );
}
