import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Be_Vietnam_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SITE_NAME, SITE_TAGLINE, siteOrigin } from "@/lib/site";
import "./globals.css";

type LayoutProps = {
  children: ReactNode;
};

/**
 * Two deliberately paired families (see .ai/DESIGN_SYSTEM.md).
 *
 * Archivo is the display voice — a grotesque with athletic/signage lineage,
 * used heavy and tight for headlines, scores and stat figures.
 *
 * Be Vietnam Pro carries body and UI text. It is drawn for Vietnamese
 * typography, so diacritics are designed rather than approximated at every
 * weight — a real choice for a Vietnamese organization, and it keeps EN and VI
 * set in the same faces at the same weights.
 *
 * Both declare the `vietnamese` subset explicitly so the VI locale is never
 * served a fallback face for accented glyphs.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Root metadata (REQ-BRAND-001/003, area M).
 *
 * `metadataBase` comes from NEXT_PUBLIC_SITE_URL because REQ-BRAND-002 is
 * blocked by OQ-001 (two conflicting domains, no decision) — see lib/site.ts.
 * The title template appends the brand to every page title, so per-page
 * metadata only supplies its own name.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description:
    "NextGen Women Hoops — a U20 women's basketball platform connecting competition, development and community.",
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

/**
 * Root layout: document, fonts and the i18n provider only.
 *
 * The public chrome (header, footer, skip link, `<main>`) lives in the
 * `(site)` route group instead, because layouts nest — keeping it here would
 * wrap the admin area in the public navigation as well, which is both wrong
 * for an operator mid-task and a waste of the viewport.
 */
export default async function RootLayout({ children }: LayoutProps) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
