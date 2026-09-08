import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const BASE = "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-fast)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 disabled:active:scale-100";
const TONES = {
  primary: "bg-brand text-brand-contrast shadow-[var(--shadow-xs)] hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] active:bg-brand-strong",
  accent: "bg-accent text-accent-contrast shadow-[var(--shadow-xs)] hover:bg-accent-strong hover:shadow-[var(--shadow-sm)] active:bg-accent-strong",
  outline: "border border-border-strong/90 bg-surface text-foreground shadow-[var(--shadow-xs)] hover:border-foreground/60 hover:bg-surface-sunken/80",
  ghost: "text-foreground hover:bg-surface-sunken/80",
  danger: "bg-danger text-white shadow-[var(--shadow-xs)] hover:brightness-110 hover:shadow-[var(--shadow-sm)] active:brightness-95",
  dangerGhost: "text-danger-text hover:bg-danger/10",
  onCourt: "border border-white/30 bg-white/5 text-white hover:border-white hover:bg-white/15",
} as const;
const SIZES = { sm: "h-9 px-3.5 text-[length:var(--text-sm)]", md: "h-11 min-h-[44px] px-5 text-[length:var(--text-sm)]", lg: "h-12 px-6 text-[length:var(--text-base)]" } as const;
export type ButtonTone = keyof typeof TONES;
export type ButtonSize = keyof typeof SIZES;
export const buttonClass = (tone: ButtonTone = "primary", extra = "", size: ButtonSize = "md") => `${BASE} ${TONES[tone]} ${SIZES[size]} ${extra}`.trim();

function Spinner({ label }: { label?: string }) {
  return <><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>{label && <span className="sr-only">{label}</span>}</>;
}

export function Button({ tone = "primary", size = "md", className = "", loading = false, loadingLabel, children, disabled, ...props }: ComponentProps<"button"> & { tone?: ButtonTone; size?: ButtonSize; loading?: boolean; loadingLabel?: string }) {
  return <button {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(tone, className, size)}><span className={loading ? "invisible" : "contents"}>{children}</span>{loading && <span className="absolute inset-0 flex items-center justify-center"><Spinner label={loadingLabel} /></span>}</button>;
}

export function ButtonLink({ tone = "primary", size = "md", className = "", href, children, ...props }: ComponentProps<typeof Link> & { tone?: ButtonTone; size?: ButtonSize }) {
  return <Link href={href} className={buttonClass(tone, className, size)} {...props}>{children}</Link>;
}

export function ActionLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={`group inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-brand-text transition-colors duration-[var(--motion-fast)] hover:text-brand-text-strong ${className}`}>{children}<span aria-hidden="true" className="transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5">→</span></Link>;
}
