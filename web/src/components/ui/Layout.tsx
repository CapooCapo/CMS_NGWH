import type { ReactNode } from "react";

/** Page gutter and measure. `prose` caps running text near 68ch. */
export function Container({ children, className = "", width = "wide" }: { children: ReactNode; className?: string; width?: "wide" | "prose" | "narrow" }) {
  const max = width === "prose" ? "max-w-[68ch]" : width === "narrow" ? "max-w-3xl" : "max-w-7xl";
  return <div className={`mx-auto w-full ${max} px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** Uppercase display label. Used above headings and on dense metadata. */
export function Eyebrow({ children, tone = "accent", className = "" }: { children: ReactNode; tone?: "accent" | "muted" | "onCourt"; className?: string }) {
  const color = tone === "accent" ? "text-accent-strong" : tone === "onCourt" ? "text-accent" : "text-muted";
  return <p className={`eyebrow ${color} ${className}`}>{children}</p>;
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-border ${className}`} />;
}

export function PageHeader({ eyebrow, title, lead, actions, children }: { eyebrow?: string; title: string; lead?: string | null; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface-sunken">
      <Container className="py-8 sm:py-12">
        {children}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>}
            <h1 className="text-[length:var(--text-3xl)] font-extrabold leading-[1.05] break-words sm:text-[length:var(--text-4xl)]">{title}</h1>
            {lead && <p className="mt-3 max-w-[60ch] text-[length:var(--text-base)] leading-relaxed text-muted">{lead}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      </Container>
    </header>
  );
}

export function SectionHeading({ children, eyebrow, action, as: Tag = "h2", id, tone = "default" }: { children: ReactNode; eyebrow?: string; action?: ReactNode; as?: "h2" | "h3"; id?: string; tone?: "default" | "onCourt" }) {
  const onCourt = tone === "onCourt";
  return (
    <div className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-3 ${onCourt ? "border-ink-border" : "border-border"}`}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow tone={onCourt ? "onCourt" : "accent"} className="mb-1.5">{eyebrow}</Eyebrow>}
        <Tag id={id} className={`text-[length:var(--text-xl)] font-extrabold leading-tight sm:text-[length:var(--text-2xl)] ${onCourt ? "text-ink-foreground" : ""}`}>{children}</Tag>
      </div>
      {action && <div className="shrink-0 pb-0.5">{action}</div>}
    </div>
  );
}
