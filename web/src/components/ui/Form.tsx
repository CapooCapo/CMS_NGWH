import type { ReactNode } from "react";

export const controlClass =
  "h-11 min-h-[44px] w-full rounded-[var(--radius-md)] border border-border-strong/90 bg-surface px-3.5 " +
  "text-[length:var(--text-sm)] text-foreground placeholder:text-muted/70 " +
  "transition-[border-color,box-shadow] duration-[var(--motion-fast)] " +
  "hover:border-foreground/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted";
export const controlInvalidClass = "border-danger hover:border-danger focus:border-danger focus:ring-danger/25";
export const textareaClass = `${controlClass} h-auto min-h-28 px-3.5 py-3 leading-relaxed`;

export function Field({ id, label, required = false, optionalLabel, hint, error, children, className = "" }: { id: string; label: string; required?: boolean; optionalLabel?: string; hint?: string; error?: string | null; children: (props: { id: string; "aria-invalid": true | undefined; "aria-describedby": string | undefined; required: boolean }) => ReactNode; className?: string }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return <div className={className}><label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[length:var(--text-sm)] font-semibold">{label}{required ? <span className="text-danger-text" aria-hidden="true">*</span> : optionalLabel && <span className="text-[length:var(--text-xs)] font-normal text-muted">{optionalLabel}</span>}</label>{children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required })}{hint && <p id={hintId ?? undefined} className="mt-1.5 text-[length:var(--text-xs)] text-muted">{hint}</p>}{error && <p id={errorId ?? undefined} className="mt-1.5 flex items-center gap-1.5 text-[length:var(--text-xs)] font-semibold text-danger-text"><svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.5-.2 5h-1.1l-.2-5h1.5ZM8 11.1a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" /></svg>{error}</p>}</div>;
}
