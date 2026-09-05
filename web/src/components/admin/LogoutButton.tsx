"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Posts to the logout endpoint (which deletes the session row) then redirects. */
export function LogoutButton({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const router = useRouter();
  const t = useTranslations("admin.actions");
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/admin/logout", { method: "POST" });
        } finally {
          // Replace so the back button cannot return to an authenticated view.
          router.replace("/admin/login");
          router.refresh();
        }
      }}
      className={`eyebrow shrink-0 rounded-[var(--radius-md)] border px-3 py-1.5 transition-colors duration-[var(--motion-fast)] disabled:opacity-60 ${
        tone === "dark"
          ? "border-white/25 text-white/85 hover:border-white hover:bg-white/10"
          : "border-border-strong text-muted hover:border-foreground hover:text-foreground"
      }`}
    >
      {pending ? t("signingOut") : t("signOut")}
    </button>
  );
}
