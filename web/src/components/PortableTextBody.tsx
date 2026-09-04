import Link from "next/link";
import { PortableText, type PortableTextComponents } from "next-sanity";

/**
 * Shared Portable Text rendering for every `blockContent` field on the site.
 *
 * The Studio's `blockContent` allows the default block styles (normal, h1–h6,
 * blockquote), bullet/number lists and `link` annotations, so all of those are
 * handled here. Spacing is owned by the block elements themselves — `mb-*` for
 * flow and `mt-*` on headings — which keeps runs of prose evenly spaced without
 * needing a wrapper that would fight the surrounding page layout.
 *
 * Heading sizes come from the shared type scale and sit one step below the
 * page `h1`, so a body heading never outranks page chrome. Blockquotes are set
 * in the display face with a gold rule, which is the one editorial flourish
 * the prose gets.
 */
export const portableTextComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="mb-5 last:mb-0">{children}</p>
    ),
    h1: ({ children }) => (
      <h2 className="mb-3 mt-10 text-[length:var(--text-2xl)] font-extrabold leading-tight first:mt-0">
        {children}
      </h2>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-10 text-[length:var(--text-xl)] font-extrabold leading-tight first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-8 text-[length:var(--text-lg)] font-bold leading-snug first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold mt-5 mb-2 first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-semibold mt-4 mb-2 first:mt-0">{children}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="eyebrow mb-2 mt-6 text-muted first:mt-0">{children}</h6>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-2 border-accent pl-5 font-display text-[length:var(--text-lg)] font-semibold not-italic leading-snug">
        {children}
      </blockquote>
    ),
  },

  list: {
    bullet: ({ children }) => (
      <ul className="mb-4 pl-6 list-disc flex flex-col gap-1 last:mb-0">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="mb-4 pl-6 list-decimal flex flex-col gap-1 last:mb-0">
        {children}
      </ol>
    ),
  },

  listItem: {
    bullet: ({ children }) => (
      <li className="leading-relaxed pl-1">{children}</li>
    ),
    number: ({ children }) => (
      <li className="leading-relaxed pl-1">{children}</li>
    ),
  },

  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
      <code className="rounded-[var(--radius-sm)] bg-surface-strong px-1.5 py-0.5 text-[0.9em] tabular">
        {children}
      </code>
    ),
    link: ({ children, value }) => {
      const href: string = value?.href ?? "";
      // Route internal hrefs through next/link; send anything off-site out
      // with the usual rel guard.
      const isInternal = href.startsWith("/");
      if (isInternal) {
        return (
          <Link
            href={href}
            className="font-medium text-brand-text underline decoration-brand-text/35 underline-offset-2 transition-colors duration-[var(--motion-fast)] hover:decoration-brand-text"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          className="font-medium text-brand-text underline decoration-brand-text/35 underline-offset-2 transition-colors duration-[var(--motion-fast)] hover:decoration-brand-text"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
  },
};

/** Renders a `blockContent` value with the shared NGWH styling. */
export function PortableTextBody({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return <PortableText value={value} components={portableTextComponents} />;
}
