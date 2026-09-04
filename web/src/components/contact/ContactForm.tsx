"use client";

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

/**
 * REQ-CONTACT-002 — contact / feedback form.
 *
 * OQ-014 leaves the field list and the routing destination undecided. The
 * fields here are the conventional minimum, and the submission is persisted for
 * the admin inbox — nothing is emailed, because there is no agreed recipient.
 * The success copy therefore promises a follow-up from the committee rather
 * than claiming a message was delivered anywhere specific.
 */
export function ContactForm({ labels }: { labels: Record<string, string> }) {
  const t = useTranslations("contact");
  const errorsT = useTranslations("errors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();

  const fieldId = (n: string) => `${baseId}-${n}`;
  const errorFor = (n: string) => (errors[n] ? errorsT(errors[n] as never) : null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFailed(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message"),
          locale,
        }),
      });
      if (response.ok) {
        setDone(true);
        formRef.current?.reset();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        fields?: Record<string, string>;
      };
      if (data.fields) setErrors(data.fields);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
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
          <h3 className="text-[length:var(--text-lg)] font-extrabold">
            {t("successTitle")}
          </h3>
        </div>
        <div className="px-6 py-5">
          <p className="max-w-[60ch] text-[length:var(--text-sm)] leading-relaxed text-muted">
            {t("successBody")}
          </p>
          <div className="mt-5">
            <Button tone="outline" onClick={() => setDone(false)}>
              {labels.again}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const field = (
    name: string,
    label: string,
    {
      type = "text",
      required = false,
      textarea = false,
      autoComplete = "",
      className,
    }: {
      type?: string;
      required?: boolean;
      textarea?: boolean;
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
        error={message}
        className={className}
      >
        {(f) =>
          textarea ? (
            <textarea
              {...f}
              name={name}
              rows={5}
              className={`${textareaClass} ${message ? controlInvalidClass : ""}`}
            />
          ) : (
            <input
              {...f}
              name={name}
              type={type}
              autoComplete={autoComplete || undefined}
              className={`${controlClass} ${message ? controlInvalidClass : ""}`}
            />
          )
        }
      </Field>
    );
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {failed && <FormAlert title={t("failed")} body={labels.unexpected} />}
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", t("name"), { required: true, autoComplete: "name" })}
        {field("email", t("emailLabel"), {
          required: true,
          type: "email",
          autoComplete: "email",
        })}
      </div>
      {field("subject", t("subject"))}
      {field("message", t("message"), { required: true, textarea: true })}
      <div>
        <Button type="submit" size="lg" loading={pending} loadingLabel={t("sending")}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
