import Image from "next/image";

/**
 * Club crest with an initials fallback.
 *
 * Most clubs have no uploaded logo, and an empty circle reads as a broken
 * image. Deriving up to two initials from the club name (skipping the "DEMO —"
 * prefix the sample data carries) gives every club a stable, legible mark at
 * every size instead.
 */
function initials(name: string): string {
  const cleaned = name.replace(/^DEMO\s*[—–-]\s*/i, "").trim();
  const words = cleaned.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export function ClubCrest({
  name,
  logoUrl,
  size = 56,
  className = "",
  rounded = "sm",
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
  rounded?: "sm" | "full";
}) {
  const radius =
    rounded === "full" ? "rounded-[var(--radius-pill)]" : "rounded-[var(--radius-md)]";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-strong ${radius} ${className}`}
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-display font-black leading-none text-muted"
          style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
