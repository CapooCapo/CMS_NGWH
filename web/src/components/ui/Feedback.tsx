import type { ReactNode } from "react";

const BADGE_TONES = { neutral: "bg-surface-strong text-foreground", brand: "bg-brand text-brand-contrast", accent: "bg-accent-tint text-accent-on-tint", live: "bg-live text-white", success: "bg-success text-white", warning: "bg-warning text-white", muted: "border border-border-strong text-muted" } as const;

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES; className?: string }) {
  return <span className={`eyebrow inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 ${BADGE_TONES[tone]} ${className}`}>{children}</span>;
}

export function LiveBadge({ label }: { label: string }) {
  return <Badge tone="live"><span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-white" />{label}</Badge>;
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface-sunken/60 px-6 py-12 text-center">{icon && <div className="text-muted">{icon}</div>}<div><p className="font-display text-[length:var(--text-lg)] font-bold">{title}</p>{body && <p className="mt-1.5 max-w-[46ch] text-[length:var(--text-sm)] text-muted">{body}</p>}</div>{action}</div>;
}

export function ErrorState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-danger/40 bg-danger/[0.05] px-6 py-10 text-center"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-danger-text" fill="currentColor"><path d="M12 2 1 21h22L12 2Zm0 6 .9 7h-1.8L12 8Zm0 9.5a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" /></svg><div><p className="font-display text-[length:var(--text-lg)] font-bold text-danger-text">{title}</p>{body && <p className="mt-1.5 max-w-[46ch] text-[length:var(--text-sm)] text-muted">{body}</p>}</div>{action}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) { return <div aria-hidden="true" className={`animate-pulse rounded-[var(--radius-md)] bg-surface-strong ${className}`} />; }
export function SkeletonCards({ count = 3 }: { count?: number }) { return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: count }, (_, i) => <div key={i} className="flex flex-col gap-3"><Skeleton className="aspect-[8/5] w-full" /><Skeleton className="h-3.5 w-24" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" /></div>)}</div>; }

export function FormAlert({ title, body, tone = "danger" }: { title: string; body?: string; tone?: "danger" | "success" }) {
  const danger = tone === "danger";
  return <div role="alert" className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-4 py-3 text-[length:var(--text-sm)] font-medium ${danger ? "border-danger/45 bg-danger/[0.06] text-danger-text" : "border-success/45 bg-success/[0.07] text-success-text"}`}><svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor">{danger ? <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.5-.2 5h-1.1l-.2-5h1.5ZM8 11.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" /> : <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.5 5.2-4.2 4.6-2.3-2.2.9-.95 1.35 1.3 3.3-3.6.95.85Z" />}</svg><div><p>{title}</p>{body && <p className="mt-0.5 font-normal opacity-85">{body}</p>}</div></div>;
}
