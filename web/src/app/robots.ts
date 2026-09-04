import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/**
 * robots.txt (area M).
 *
 * The admin area and every API route are disallowed: they are either
 * authenticated or non-content endpoints, and there is nothing there for a
 * crawler. This is a crawl directive, not a security control — access is
 * enforced server-side in `requireRole()` and on each admin page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
    host: siteOrigin(),
  };
}
