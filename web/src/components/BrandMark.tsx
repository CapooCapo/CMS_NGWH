import { SITE_NAME_SHORT } from "@/lib/site";

/**
 * NGWH wordmark.
 *
 * Inline SVG rather than a bitmap so it stays crisp and inherits
 * `currentColor` from whichever ground it sits on (crimson header, dark
 * footer). No requirement supplies a logo file, so the mark is built from the
 * subject: a ball's seam geometry, drawn at a consistent stroke weight, set
 * against the wordmark in the display face.
 */
export function BrandMark({
  className = "",
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="h-9 w-9 shrink-0"
        fill="none"
        strokeLinecap="round"
      >
        <circle cx="20" cy="20" r="17.5" stroke="currentColor" strokeWidth="2.4" />
        <path d="M2.5 20h35M20 2.5v35" stroke="currentColor" strokeWidth="2.4" />
        <path
          d="M7.4 7.4c6.6 5.4 6.6 20 0 25.2M32.6 7.4c-6.6 5.4-6.6 20 0 25.2"
          stroke="currentColor"
          strokeWidth="2.4"
        />
      </svg>
      {showText && (
        <span className="font-display whitespace-nowrap text-[0.95rem] font-extrabold uppercase leading-none tracking-[-0.01em] sm:text-base">
          {SITE_NAME_SHORT}
        </span>
      )}
    </span>
  );
}
