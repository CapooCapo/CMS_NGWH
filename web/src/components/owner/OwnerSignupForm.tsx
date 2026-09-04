"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/BrandMark";
import { Button, Card, Field, FormAlert, controlClass, controlInvalidClass } from "@/components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

/**
 * Self-service account signup, the counterpart to `OwnerLoginForm`.
 *
 * Account creation does not create a session. On success this always sends
 * the person to sign in, keeping signup and authentication as separate steps.
 */
export function OwnerSignupForm({
  labels,
}: {
  labels: {
    title: string;
    subtitle: string;
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    passwordHint: string;
    nameTooShort: string;
    passwordTooShort: string;
    passwordMismatch: string;
    submit: string;
    submitting: string;
    emailTaken: string;
    serverError: string;
    haveAccount: string;
    signIn: string;
  };
}) {
  const router = useRouter();
  const errorsT = useTranslations("errors");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<SignupValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const id = useId();

  const clientErrors = {
    fullName: values.fullName && values.fullName.trim().length < 2 ? labels.nameTooShort : null,
    email: values.email && !EMAIL_RE.test(values.email.trim()) ? errorsT("invalidEmail") : null,
    password: values.password && values.password.length < 10 ? labels.passwordTooShort : null,
    confirmPassword:
      values.confirmPassword && values.password !== values.confirmPassword
        ? labels.passwordMismatch
        : null,
  };
  const complete = Object.values(values).every((value) => value.trim().length > 0);
  const canSubmit = complete && !Object.values(clientErrors).some(Boolean);

  const errorFor = (name: keyof SignupValues) => {
    if (clientErrors[name]) return clientErrors[name];
    const code = fieldErrors[name];
    if (!code) return null;
    return code === "duplicate" ? labels.emailTaken : errorsT(code as never);
  };

  function updateValue(name: keyof SignupValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/owner/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
        }),
      });
      if (response.ok) {
        router.replace("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        fields?: Record<string, string>;
      };
      if (data.fields?.email === "duplicate") {
        setError(labels.emailTaken);
        setFieldErrors({ email: "duplicate" });
      } else if (data.fields) {
        setFieldErrors(data.fields);
      } else {
        setError(labels.serverError);
      }
    } catch {
      setError(labels.serverError);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm overflow-hidden">
      <div className="on-court flex flex-col items-center gap-3 bg-ink px-6 py-7 text-center text-ink-foreground">
        <span className="text-accent">
          <BrandMark showText={false} />
        </span>
        <div>
          <h1 className="text-[length:var(--text-lg)] font-extrabold">{labels.title}</h1>
          <p className="mt-1 text-[length:var(--text-xs)] text-ink-muted">{labels.subtitle}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 px-6 py-6">
        {error && <FormAlert title={error} />}
        <Field id={`${id}-n`} label={labels.fullName} required error={errorFor("fullName")}>
          {(field) => (
            <input
              {...field}
              name="fullName"
              type="text"
              autoComplete="name"
              autoFocus
              value={values.fullName}
              onChange={(event) => updateValue("fullName", event.currentTarget.value)}
              className={`${controlClass} ${errorFor("fullName") ? controlInvalidClass : ""}`}
            />
          )}
        </Field>
        <Field id={`${id}-e`} label={labels.email} required error={errorFor("email")}>
          {(field) => (
            <input
              {...field}
              name="email"
              type="email"
              autoComplete="username"
              value={values.email}
              onChange={(event) => updateValue("email", event.currentTarget.value)}
              className={`${controlClass} ${errorFor("email") ? controlInvalidClass : ""}`}
            />
          )}
        </Field>
        <Field
          id={`${id}-p`}
          label={labels.password}
          required
          hint={labels.passwordHint}
          error={errorFor("password")}
        >
          {(field) => (
            <input
              {...field}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={values.password}
              onChange={(event) => updateValue("password", event.currentTarget.value)}
              className={`${controlClass} ${errorFor("password") ? controlInvalidClass : ""}`}
            />
          )}
        </Field>
        <Field
          id={`${id}-confirm-p`}
          label={labels.confirmPassword}
          required
          error={errorFor("confirmPassword")}
        >
          {(field) => (
            <input
              {...field}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={values.confirmPassword}
              onChange={(event) => updateValue("confirmPassword", event.currentTarget.value)}
              className={`${controlClass} ${errorFor("confirmPassword") ? controlInvalidClass : ""}`}
            />
          )}
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          loading={pending}
          loadingLabel={labels.submitting}
        >
          {labels.submit}
        </Button>
        <p className="text-center text-[length:var(--text-xs)] text-muted">
          {labels.haveAccount}{" "}
          <Link
            href="/login"
            className="font-semibold underline"
          >
            {labels.signIn}
          </Link>
        </p>
      </form>
    </Card>
  );
}
