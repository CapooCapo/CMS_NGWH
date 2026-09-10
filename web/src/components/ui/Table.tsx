import type { ReactNode } from "react";

export function Table({ caption, head, children, minWidth = "36rem", note }: { caption: string; head: ReactNode; children: ReactNode; minWidth?: string; note?: string }) {
  return <div><div className="table-scroll overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]"><table className="w-full border-collapse text-[length:var(--text-sm)]" style={{ minWidth }}><caption className="sr-only">{caption}</caption><thead className="bg-surface-sunken"><tr>{head}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>{note && <p className="mt-2 text-[length:var(--text-xs)] text-muted">{note}</p>}</div>;
}

export function Th({ children, align = "left", sticky = false, title, className = "" }: { children: ReactNode; align?: "left" | "right" | "center"; sticky?: boolean; title?: string; className?: string }) {
  return <th scope="col" title={title} className={`eyebrow whitespace-nowrap px-4 py-3 text-muted ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${sticky ? "sticky left-0 z-10 bg-surface-sunken" : ""} ${className}`}>{children}</th>;
}

export function Td({ children, align = "left", numeric = false, strong = false, sticky = false, header = false, className = "", colSpan }: { children: ReactNode; align?: "left" | "right" | "center"; numeric?: boolean; strong?: boolean; sticky?: boolean; header?: boolean; className?: string; colSpan?: number }) {
  const Tag = header ? "th" : "td";
  return <Tag {...(header ? { scope: "row" as const } : {})} colSpan={colSpan} className={`px-4 py-3.5 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${numeric ? "tabular" : ""} ${strong ? "font-bold" : header ? "font-semibold" : ""} ${sticky ? "sticky left-0 z-10 bg-surface" : ""} ${className}`}>{children}</Tag>;
}
