"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button,
  Card,
  Field,
  FormAlert,
  controlClass,
  controlInvalidClass,
  textareaClass,
} from "@/components/ui";

type Labels = Record<string, string>;

function formatFileSize(bytes: number, locale: string): string {
  const megabytes = bytes / (1024 * 1024);
  const value = megabytes >= 1 ? megabytes : bytes / 1024;
  const unit = megabytes >= 1 ? "MB" : "KB";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

/**
 * REQ-REG-001/002/003 — the club registration form.
 *
 * Submits `multipart/form-data` to `/api/registrations` so file uploads and
 * fields travel together. Server-side validation is authoritative: this
 * component only renders the field errors the API returns (keyed by field
 * name) and marks the inputs with `aria-invalid` / `aria-describedby` so the
 * message is announced with the control.
 *
 * `noValidate` is set so the browser does not pre-empt the server's messages
 * with its own untranslated ones; `required` is kept for semantics.
 *
 * The page only renders this form to a signed-in account, but the endpoint is
 * the real gate — so two non-field outcomes are handled explicitly: a 401
 * (session expired while the form was open) sends the person to sign in and
 * come back here, and a 409 means they already have a submission awaiting
 * review.
 */
export function RegistrationForm({ labels }: { labels: Labels }) {
  const router = useRouter();
  const t = useTranslations("register");
  const errorsT = useTranslations("errors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();

  const fieldId = (name: string) => `${baseId}-${name}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFailed(false);
    setConflict(false);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (response.ok) {
        const data = (await response.json()) as { id: number };
        setSubmitted(data.id);
        formRef.current?.reset();
        setSelectedFiles([]);
        return;
      }
      if (response.status === 401) {
        // The session lapsed while this page was open. Bounce through login
        // and return here rather than showing a dead-end error.
        router.push(`/login?next=${encodeURIComponent("/clubs/register")}`);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        fields?: Record<string, string>;
        error?: string;
      };
      if (response.status === 409 || data.error === "alreadyPending") {
        setConflict(true);
        // The server-rendered status panel is the source of truth for what
        // that pending submission is, so re-read the page.
        router.refresh();
      } else if (data.fields) setErrors(data.fields);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (submitted !== null) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-success/[0.08] px-6 py-4">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-6 w-6 shrink-0 text-success-text"
            fill="currentColor"
          >
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 7.4-6 6.6-3.4-3.3 1.3-1.4 2 1.9 4.7-5.2L17 9.4Z" />
          </svg>
          <h2 className="text-[length:var(--text-xl)] font-extrabold">
            {t("successTitle")}
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="max-w-[60ch] text-[length:var(--text-sm)] leading-relaxed text-muted">
            {t("successBody")}
          </p>
          <p className="mt-5 flex items-baseline gap-2 text-[length:var(--text-sm)]">
            <span className="eyebrow text-muted">{t("successReference")}</span>
            <span className="font-display tabular text-[length:var(--text-lg)] font-black">
              #{submitted}
            </span>
          </p>
          <div className="mt-6">
            <Button type="button" tone="outline" onClick={() => router.refresh()}>
              {t("viewStatus")}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const errorFor = (name: string) =>
    errors[name] ? errorsT(errors[name] as never) : null;
  const rootError = errorFor("_");

  /** One field, wired through the shared `Field` primitive. */
  const textField = (
    name: string,
    label: string,
    {
      type = "text",
      required = false,
      textarea = false,
      hint,
      autoComplete,
      className,
    }: {
      type?: string;
      required?: boolean;
      textarea?: boolean;
      hint?: string;
      autoComplete?: string;
      className?: string;
    } = {}
  ) => {
    const message = errorFor(name);
    return (
      <Field
        key={name}
        id={fieldId(name)}
        label={label}
        required={required}
        optionalLabel={labels.optional}
        hint={hint}
        error={message}
        className={className}
      >
        {(field) =>
          textarea ? (
            <textarea
              {...field}
              name={name}
              rows={4}
              className={`${textareaClass} ${message ? controlInvalidClass : ""}`}
            />
          ) : (
            <input
              {...field}
              name={name}
              type={type}
              autoComplete={autoComplete}
              className={`${controlClass} ${message ? controlInvalidClass : ""}`}
            />
          )
        }
      </Field>
    );
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {(Object.keys(errors).length > 0 || failed || conflict) && (
        <FormAlert
          title={
            conflict
              ? labels.alreadyPending
              : failed
                ? t("failed")
                : t("fixErrors")
          }
          body={failed ? labels.unexpected : rootError ?? undefined}
        />
      )}

      <fieldset>
        <legend className="eyebrow mb-3 text-muted">{labels.clubSection}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("clubName", t("clubName"), {
            required: true,
            autoComplete: "organization",
          })}
          {textField("operatingRegion", t("operatingRegion"), { required: true })}
        </div>
      </fieldset>

      <fieldset className="border-t border-border pt-6">
        <legend className="eyebrow mb-3 text-muted">{labels.repSection}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("representativeName", t("representativeName"), {
            required: true,
            autoComplete: "name",
          })}
          {textField("representativeEmail", t("representativeEmail"), {
            required: true,
            type: "email",
            autoComplete: "email",
          })}
          {textField("representativePhone", t("representativePhone"), {
            type: "tel",
            autoComplete: "tel",
            className: "sm:col-span-2",
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-6">
        {textField("notes", t("notes"), { textarea: true })}

      {/* REQ-REG-003 — uploads. `accept` mirrors the server allow-list. */}
        <div>
          <Field
            id={fieldId("documents")}
            label={t("documents")}
            optionalLabel={labels.optional}
            hint={t("documentsHint")}
            error={errorFor("documents")}
          >
            {(field) => (
              <input
                {...field}
                name="documents"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => setSelectedFiles(Array.from(event.currentTarget.files ?? []))}
                className={`${controlClass} cursor-pointer py-2.5 file:mr-3 file:cursor-pointer file:rounded-[var(--radius-sm)] file:border-0 file:bg-surface-strong file:px-3 file:py-1.5 file:text-[length:var(--text-sm)] file:font-semibold ${
                  errorFor("documents") ? controlInvalidClass : ""
                }`}
              />
            )}
          </Field>
          {selectedFiles.length > 0 && (
            <div aria-live="polite" className="mt-3 border-t border-border pt-3">
              <p className="text-[length:var(--text-xs)] font-semibold text-muted">
                {t("documentsSelected", { count: selectedFiles.length })}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[length:var(--text-sm)]">
                {selectedFiles.map((file) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex flex-wrap gap-x-2">
                    <span className="break-all font-medium">{file.name}</span>
                    <span className="text-muted">{formatFileSize(file.size, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </fieldset>

      <div className="border-t border-border pt-6">
        <Button type="submit" size="lg" loading={pending} loadingLabel={t("submitting")}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
