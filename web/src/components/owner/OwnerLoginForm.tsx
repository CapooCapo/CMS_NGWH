"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Button, Card, Field, FormAlert, controlClass } from "@/components/ui";

/**
 * Club Owner sign-in — the real, server-validated login this workflow needs.
 * Mirrors `components/admin/LoginForm.tsx`'s shape (same error handling, same
 * generic "incorrect email or password" message for any of unknown-email /
 * wrong-password / deactivated-account, for the same anti-enumeration reason)
 * against the separate `/api/owner/login` endpoint and session.
 */
export function OwnerLoginForm({
  labels,
}: {
  labels: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    invalidCredentials: string;
    rateLimited: string;
    serverError: string;
    noAccount: string;
    signUp: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const id = useId();
  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      if (response.ok) {
        router.replace("/clubs");
        router.refresh();
        return;
      }
      setError(
        response.status === 401
          ? labels.invalidCredentials
          : response.status === 429
            ? labels.rateLimited
            : labels.serverError
      );
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

      <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 py-6">
        {error && <FormAlert title={error} />}
        <Field id={`${id}-e`} label={labels.email} required>
          {(field) => (
            <input
              {...field}
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              className={controlClass}
            />
          )}
        </Field>
        <Field id={`${id}-p`} label={labels.password} required>
          {(field) => (
            <input
              {...field}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              className={controlClass}
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
          {labels.noAccount}{" "}
          <Link
            href="/signup"
            className="font-semibold underline"
          >
            {labels.signUp}
          </Link>
        </p>
      </form>
    </Card>
  );
}
