import { useState, type ReactNode } from "react";

/** Collapsible wrapper so create forms do not dominate a list page. */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]"><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-[length:var(--text-sm)] font-semibold transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken/70">{label}<svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted transition-transform duration-[var(--motion-base)] ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 8l5 5 5-5" /></svg></button>{open && <div className="border-t border-border bg-surface-sunken/25 p-5 sm:p-6">{children}</div>}</div>;
}
