import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Shared presentational primitives for the whole platform — public and admin.
 *
 * The system is documented in `.ai/DESIGN_SYSTEM.md`. Two rules drive the
 * shapes below:
 *
 *  - **Not everything is a card.** Border, fill, radius and shadow each say
 *    "separate object", so they are spent by role: `Card` has three distinct
 *    variants and most content uses hairline rules instead.
 *  - **Section boundaries are drawn, not framed.** `SectionHeading` ends in a
 *    full-width rule (the painted court line). It replaces the accent rail the
 *    previous pass used, which carried no information.
 */

/* ------------------------------------------------------------------ layout */

/** Page gutter and measure. `prose` caps running text near 68ch. */
export function Container({
  children,
  className = "",
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "prose" | "narrow";
}) {
  const max =
    width === "prose" ? "max-w-[68ch]" : width === "narrow" ? "max-w-3xl" : "max-w-7xl";
  return (
    <div className={`mx-auto w-full ${max} px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

/** Uppercase display label. Used above headings and on dense metadata. */
export function Eyebrow({
  children,
  tone = "accent",
  className = "",
}: {
  children: ReactNode;
  tone?: "accent" | "muted" | "onCourt";
  className?: string;
}) {
  const color =
    tone === "accent"
      ? "text-accent-strong"
      : tone === "onCourt"
        ? "text-accent"
        : "text-muted";
  return <p className={`eyebrow ${color} ${className}`}>{children}</p>;
}

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-border ${className}`} />;
}

/**
 * Page masthead: eyebrow, `h1`, optional lead and actions, closed by a rule.
 *
 * Sits on the sunken warm surface so it reads as a band rather than a card,
 * and every page gets the same opening rhythm.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string | null;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface-sunken">
      <Container className="py-8 sm:py-12">
        {children}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>}
            {/* `break-words`: page titles carry user-supplied text (a club
                name from a registration, an article title), and a single long
                token at this type size overflows a 375px viewport and makes
                the whole page scroll sideways. `min-w-0` on the parent only
                lets the box shrink; the word itself still has to be breakable. */}
            <h1 className="text-[length:var(--text-3xl)] font-extrabold leading-[1.05] break-words sm:text-[length:var(--text-4xl)]">
              {title}
            </h1>
            {lead && (
              <p className="mt-3 max-w-[60ch] text-[length:var(--text-base)] leading-relaxed text-muted">
                {lead}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      </Container>
    </header>
  );
}

/**
 * Section heading. The trailing rule marks the section boundary — that is the
 * structural information the old accent rail did not carry.
 */
export function SectionHeading({
  children,
  eyebrow,
  action,
  as: Tag = "h2",
  id,
  tone = "default",
}: {
  children: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
  tone?: "default" | "onCourt";
}) {
  const onCourt = tone === "onCourt";
  return (
    <div
      className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-3 ${
        onCourt ? "border-ink-border" : "border-border"
      }`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <Eyebrow tone={onCourt ? "onCourt" : "accent"} className="mb-1.5">
            {eyebrow}
          </Eyebrow>
        )}
        <Tag
          id={id}
          className={`text-[length:var(--text-xl)] font-extrabold leading-tight sm:text-[length:var(--text-2xl)] ${
            onCourt ? "text-ink-foreground" : ""
          }`}
        >
          {children}
        </Tag>
      </div>
      {action && <div className="shrink-0 pb-0.5">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- buttons */

/*
 * `inline-flex` + fixed height keeps every control on one baseline, and the
 * loading state swaps the label for a spinner *inside the same box* so the
 * button never changes width mid-request.
 */
const BUTTON_BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] " +
  "font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-fast)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 disabled:active:scale-100";

const BUTTON_TONES = {
  primary:
    "bg-brand text-brand-contrast shadow-[var(--shadow-xs)] hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] active:bg-brand-strong",
  accent:
    "bg-accent text-accent-contrast shadow-[var(--shadow-xs)] hover:bg-accent-strong hover:shadow-[var(--shadow-sm)] active:bg-accent-strong",
  outline:
    "border border-border-strong/90 bg-surface text-foreground shadow-[var(--shadow-xs)] hover:border-foreground/60 hover:bg-surface-sunken/80",
  ghost: "text-foreground hover:bg-surface-sunken/80",
  danger: "bg-danger text-white shadow-[var(--shadow-xs)] hover:brightness-110 hover:shadow-[var(--shadow-sm)] active:brightness-95",
  dangerGhost: "text-danger-text hover:bg-danger/10",
  onCourt:
    "border border-white/30 bg-white/5 text-white hover:border-white hover:bg-white/15",
} as const;

const BUTTON_SIZES = {
  sm: "h-9 px-3.5 text-[length:var(--text-sm)]",
  md: "h-11 min-h-[44px] px-5 text-[length:var(--text-sm)]",
  lg: "h-12 px-6 text-[length:var(--text-base)]",
} as const;

export type ButtonTone = keyof typeof BUTTON_TONES;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export function buttonClass(
  tone: ButtonTone = "primary",
  extra = "",
  size: ButtonSize = "md"
): string {
  return `${BUTTON_BASE} ${BUTTON_TONES[tone]} ${BUTTON_SIZES[size]} ${extra}`.trim();
}

function Spinner({ label }: { label?: string }) {
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin"
        fill="none"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

export function Button({
  tone = "primary",
  size = "md",
  className = "",
  loading = false,
  loadingLabel,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(tone, className, size)}
    >
      {/* Label stays in flow but hidden, so the width cannot change. */}
      <span className={loading ? "invisible" : "contents"}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner label={loadingLabel} />
        </span>
      )}
    </button>
  );
}

export function ButtonLink({
  tone = "primary",
  size = "md",
  className = "",
  href,
  children,
  ...props
}: ComponentProps<typeof Link> & { tone?: ButtonTone; size?: ButtonSize }) {
  return (
    <Link href={href} className={buttonClass(tone, className, size)} {...props}>
      {children}
    </Link>
  );
}

/** Text link that reads as an action without becoming a button. */
export function ActionLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold text-brand-text transition-colors duration-[var(--motion-fast)] hover:text-brand-text-strong ${className}`}
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ badges */

const BADGE_TONES = {
  neutral: "bg-surface-strong text-foreground",
  brand: "bg-brand text-brand-contrast",
  accent: "bg-accent-tint text-accent-on-tint",
  live: "bg-live text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  muted: "border border-border-strong text-muted",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={`eyebrow inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Live state. The dot pulses; `prefers-reduced-motion` stops it globally. */
export function LiveBadge({ label }: { label: string }) {
  return (
    <Badge tone="live">
      <span aria-hidden="true" className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
      {label}
    </Badge>
  );
}

/* ------------------------------------------------------------------- cards */

/**
 * Three variants by role rather than one card for everything:
 *  - `flat`   — rules only. Grouping without claiming importance.
 *  - `raised` — border plus hover elevation. For a card that is a link.
 *  - `panel`  — the dark court ground. Hero and scoreboard only.
 */
export function Card({
  children,
  className = "",
  variant = "flat",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: "flat" | "raised" | "panel";
  as?: "div" | "article" | "li" | "section";
}) {
  const styles = {
    flat: "border border-border/80 bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)]",
    raised:
      "border border-border/80 bg-surface rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] transition-[box-shadow,border-color,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]",
    panel: "on-court bg-ink text-ink-foreground rounded-[var(--radius-xl)] border border-ink-border",
  }[variant];
  return <Tag className={`${styles} ${className}`}>{children}</Tag>;
}

/* ------------------------------------------------------------------ states */

/*
 * Empty, error and loading share one language so a failure never looks like an
 * empty result: empty is quiet and dashed, error is bordered in danger and
 * announced, loading is a shaped skeleton rather than a spinner.
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface-sunken/60 px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="font-display text-[length:var(--text-lg)] font-bold">{title}</p>
        {body && <p className="mt-1.5 max-w-[46ch] text-[length:var(--text-sm)] text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-danger/40 bg-danger/[0.05] px-6 py-10 text-center"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-danger-text" fill="currentColor">
        <path d="M12 2 1 21h22L12 2Zm0 6 .9 7h-1.8L12 8Zm0 9.5a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
      </svg>
      <div>
        <p className="font-display text-[length:var(--text-lg)] font-bold text-danger-text">{title}</p>
        {body && <p className="mt-1.5 max-w-[46ch] text-[length:var(--text-sm)] text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[var(--radius-md)] bg-surface-strong ${className}`}
    />
  );
}

/** Loading placeholder shaped like the card grid it replaces. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-[8/5] w-full" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- forms */

/** One control height and one border treatment for every input type. */
export const controlClass =
  "h-11 min-h-[44px] w-full rounded-[var(--radius-md)] border border-border-strong/90 bg-surface px-3.5 " +
  "text-[length:var(--text-sm)] text-foreground placeholder:text-muted/70 " +
  "transition-[border-color,box-shadow] duration-[var(--motion-fast)] " +
  "hover:border-foreground/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted";

export const controlInvalidClass =
  "border-danger hover:border-danger focus:border-danger focus:ring-danger/25";

export const textareaClass = `${controlClass} h-auto min-h-28 px-3.5 py-3 leading-relaxed`;

/**
 * Label + control + hint + error, wired for assistive tech.
 *
 * `htmlFor`/`id` and the `aria-describedby` ids are composed here so no caller
 * has to remember to connect an error message to its input.
 */
export function Field({
  id,
  label,
  required = false,
  optionalLabel,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  hint?: string;
  error?: string | null;
  children: (props: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
    required: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline gap-1.5 text-[length:var(--text-sm)] font-semibold"
      >
        {label}
        {required ? (
          <span className="text-danger-text" aria-hidden="true">
            *
          </span>
        ) : (
          optionalLabel && (
            <span className="text-[length:var(--text-xs)] font-normal text-muted">
              {optionalLabel}
            </span>
          )
        )}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        required,
      })}
      {hint && (
        <p id={hintId ?? undefined} className="mt-1.5 text-[length:var(--text-xs)] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId ?? undefined}
          className="mt-1.5 flex items-center gap-1.5 text-[length:var(--text-xs)] font-semibold text-danger-text"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.5-.2 5h-1.1l-.2-5h1.5ZM8 11.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level error summary, announced on submit. */
export function FormAlert({
  title,
  body,
  tone = "danger",
}: {
  title: string;
  body?: string;
  tone?: "danger" | "success";
}) {
  const danger = tone === "danger";
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-4 py-3 text-[length:var(--text-sm)] font-medium ${
        danger
          ? "border-danger/45 bg-danger/[0.06] text-danger-text"
          : "border-success/45 bg-success/[0.07] text-success-text"
      }`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor">
        {danger ? (
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.5-.2 5h-1.1l-.2-5h1.5ZM8 11.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" />
        ) : (
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.5 5.2-4.2 4.6-2.3-2.2.9-.95 1.35 1.3 3.3-3.6.95.85Z" />
        )}
      </svg>
      <div>
        <p>{title}</p>
        {body && <p className="mt-0.5 font-normal opacity-85">{body}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

/**
 * Data table. Wide tables stay usable on small screens by scrolling inside
 * their own container — with a soft edge affordance from `.table-scroll` and a
 * sticky first column so the row's identity never scrolls away.
 *
 * `caption` is required: it is the table's accessible name.
 */
export function Table({
  caption,
  head,
  children,
  minWidth = "36rem",
  note,
}: {
  caption: string;
  head: ReactNode;
  children: ReactNode;
  minWidth?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="table-scroll overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]">
        <table className="w-full border-collapse text-[length:var(--text-sm)]" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken">
            <tr>{head}</tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
      {note && <p className="mt-2 text-[length:var(--text-xs)] text-muted">{note}</p>}
    </div>
  );
}

export function Th({
  children,
  align = "left",
  sticky = false,
  title,
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  sticky?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={`eyebrow whitespace-nowrap px-4 py-3 text-muted ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${sticky ? "sticky left-0 z-10 bg-surface-sunken" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  numeric = false,
  strong = false,
  sticky = false,
  header = false,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  numeric?: boolean;
  strong?: boolean;
  /** Sticky first column, so a scrolled row keeps its label. */
  sticky?: boolean;
  /** Renders `<th scope="row">` — use for the column that identifies the row. */
  header?: boolean;
  className?: string;
  /** For a full-width row, e.g. an inline edit panel spanning every column. */
  colSpan?: number;
}) {
  const Tag = header ? "th" : "td";
  return (
    <Tag
      {...(header ? { scope: "row" as const } : {})}
      colSpan={colSpan}
      className={`px-4 py-3.5 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${numeric ? "tabular" : ""} ${strong ? "font-bold" : header ? "font-semibold" : ""} ${
        sticky ? "sticky left-0 z-10 bg-surface" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------- breadcrumbs */

/** Trail for pages two levels deep. Current page is text, not a link. */
export function Breadcrumbs({
  items,
  label,
}: {
  items: { href?: string; label: string }[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-[length:var(--text-xs)]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="font-medium text-muted transition-colors duration-[var(--motion-fast)] hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="font-semibold">
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-border-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* --------------------------------------------------------- metric / stat  */

/**
 * Label + figure pair. Used for club facts and admin counters. Deliberately
 * not a card: it is a definition list, so it is marked up as one.
 */
export function StatList({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={`flex flex-wrap gap-x-10 gap-y-4 ${className}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="eyebrow mb-1 text-muted">{item.label}</dt>
          <dd className="font-display text-[length:var(--text-lg)] font-bold tabular">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
