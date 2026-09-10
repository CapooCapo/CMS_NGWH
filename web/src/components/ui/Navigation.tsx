import Link from "next/link";

export function Breadcrumbs({ items, label }: { items: { href?: string; label: string }[]; label: string }) {
  return <nav aria-label={label} className="mb-5"><ol className="flex flex-wrap items-center gap-1.5 text-[length:var(--text-xs)]">{items.map((item, i) => { const last = i === items.length - 1; return <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">{item.href && !last ? <Link href={item.href} className="font-medium text-muted transition-colors duration-[var(--motion-fast)] hover:text-foreground hover:underline">{item.label}</Link> : <span aria-current={last ? "page" : undefined} className="font-semibold">{item.label}</span>}{!last && <span aria-hidden="true" className="text-border-strong">/</span>}</li>; })}</ol></nav>;
}
