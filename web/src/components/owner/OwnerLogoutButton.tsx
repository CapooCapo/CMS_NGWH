"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Posts to the Club Owner logout endpoint (deletes the session row), then redirects. */
export function OwnerLogoutButton({
  label,
  tone = "light",
  className = "",
}: {
  label: string;
  tone?: "dark" | "light" | "plain";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/owner/logout", { method: "POST" });
        } finally {
          router.replace("/login");
          router.refresh();
        }
      }}
      className={`inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border px-3.5 text-[length:var(--text-sm)] font-semibold transition-colors duration-[var(--motion-fast)] disabled:opacity-60 ${
        tone === "dark"
          ? "border-white/25 text-white/85 hover:border-white hover:bg-white/10"
          : tone === "plain"
            ? "border-danger/30 text-danger-text hover:bg-danger/10"
            : "border-white/35 text-white/90 hover:border-white hover:bg-white/15"
      } ${className}`}
    >
      {pending ? "…" : label}
    </button>
  );
}
