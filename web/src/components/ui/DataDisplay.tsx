import type { ReactNode } from "react";

export function Card({ children, className = "", variant = "flat", as: Tag = "div" }: { children: ReactNode; className?: string; variant?: "flat" | "raised" | "panel"; as?: "div" | "article" | "li" | "section" }) {
  const styles = {
    flat: "border border-border/80 bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)]",
    raised: "border border-border/80 bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] transition-[box-shadow,border-color,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]",
    panel: "on-court bg-ink text-ink-foreground rounded-[var(--radius-xl)] border border-ink-border",
  }[variant];
  return <Tag className={`${styles} ${className}`}>{children}</Tag>;
}

export function StatList({ items, className = "" }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return <dl className={`flex flex-wrap gap-x-10 gap-y-4 ${className}`}>{items.map((item) => <div key={item.label}><dt className="eyebrow mb-1 text-muted">{item.label}</dt><dd className="font-display text-[length:var(--text-lg)] font-bold tabular">{item.value}</dd></div>)}</dl>;
}
