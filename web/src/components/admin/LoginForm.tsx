"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button, Card, Field, FormAlert, controlClass } from "@/components/ui";

/**
 * Staff sign-in.
 *
 * The error message is deliberately identical for an unknown user, a wrong
 * password and a deactivated account — the API returns one code for all three,
 * so the form cannot be used to discover which usernames exist.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const t = useTranslations("admin.login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setError(
        response.status === 401
          ? t("invalidCredentials")
          : t("failed")
      );
    } catch {
      setError(t("failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm overflow-hidden">
      <div className="on-court relative flex flex-col items-center gap-3 bg-ink px-6 py-7 text-center text-ink-foreground">
        <div className="absolute right-3 top-3">
          <LanguageSwitcher />
        </div>
        <span className="text-accent">
          <BrandMark showText={false} />
        </span>
        <div>
          <h1 className="text-[length:var(--text-lg)] font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-[length:var(--text-xs)] text-ink-muted">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 py-6">
        {error && <FormAlert title={error} />}
        <Field id={`${id}-u`} label={t("username")} required>
          {(field) => (
            <input
              {...field}
              name="username"
              autoComplete="username"
              autoFocus
              className={controlClass}
            />
          )}
        </Field>
        <Field id={`${id}-p`} label={t("password")} required>
          {(field) => (
            <input
              {...field}
              name="password"
              type="password"
              autoComplete="current-password"
              className={controlClass}
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={pending} loadingLabel={t("signingIn")}>
          {t("signIn")}
        </Button>
      </form>
    </Card>
  );
}
