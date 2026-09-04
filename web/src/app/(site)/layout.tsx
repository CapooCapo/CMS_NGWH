import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Public site chrome.
 *
 * Lives in a `(site)` route group so the admin area does not inherit it —
 * URLs are unchanged by the group. The column is a flex stack with the footer
 * pushed down by `mt-auto`, so a short page still has the footer at the bottom
 * of the viewport rather than floating mid-screen.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("nav");
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
