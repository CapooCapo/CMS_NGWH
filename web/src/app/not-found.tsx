import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { NotFoundContent } from "@/components/site/NotFoundContent";

/**
 * 404 boundary for URLs outside the `(site)` group, which therefore get no
 * public chrome from a layout — so this one supplies it.
 */
export default async function NotFound() {
  const t = await getTranslations("nav");
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </div>
  );
}
