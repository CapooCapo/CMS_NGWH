"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocaleAction } from "@/i18n/actions";
import { SUPPORTED_LOCALES } from "@/i18n/config";

const LABELS: Record<string, string> = { en: "EN", vi: "VI" };

/**
 * REQ-GLOBAL-001 / BR-003 — locale switcher.
 *
 * The active locale stays visible as a disabled segment rather than being
 * hidden, so the control keeps a stable width (no layout shift on switch) and
 * `aria-current` still tells assistive tech which language is active.
 */
export function LanguageSwitcher({
  tone = "onBrand",
}: {
  tone?: "onBrand" | "default";
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const onBrand = tone === "onBrand";
  const fullNames: Record<string, string> = {
    en: t("english"),
    vi: t("vietnamese"),
  };

  return (
    <div
      role="group"
      aria-label={t("language")}
      aria-busy={isPending || undefined}
      className={`inline-flex items-center rounded-[var(--radius-pill)] p-0.5 border ${
        onBrand ? "border-white/25 bg-black/15" : "border-border bg-surface-sunken/60"
      }`}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            disabled={isPending || active}
            aria-current={active ? "true" : undefined}
            title={fullNames[code]}
            onClick={() => startTransition(() => setLocaleAction(code))}
            className={[
              "eyebrow rounded-[var(--radius-pill)] px-2.5 py-1 transition-all duration-[var(--motion-fast)]",
              active
                ? onBrand
                  ? "bg-white text-brand shadow-[var(--shadow-xs)]"
                  : "bg-foreground text-background shadow-[var(--shadow-xs)]"
                : onBrand
                  ? "text-white/75 hover:bg-white/10 hover:text-white"
                  : "text-muted hover:bg-surface hover:text-foreground",
              isPending && !active ? "opacity-60" : "",
            ].join(" ")}
          >
            <span className="sr-only">{fullNames[code]}</span>
            <span aria-hidden="true">{LABELS[code] ?? code.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
