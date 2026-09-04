import { NotFoundContent } from "@/components/site/NotFoundContent";

/**
 * 404 boundary for public routes. The `(site)` layout already provides the
 * header, footer and `<main>`, so this renders content only.
 */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
