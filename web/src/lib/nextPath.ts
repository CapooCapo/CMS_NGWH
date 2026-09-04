/**
 * Normalises a post-login/post-signup return path from the query string.
 *
 * Only a same-site absolute path survives, so `?next=` / `?redirect=` can
 * never become an open redirect: a value starting `//` (protocol-relative,
 * e.g. `//evil.example`) or carrying a scheme is discarded along with
 * anything that is not a path at all.
 *
 * Both parameter names are accepted because the middleware and the login
 * links use `next`, while `redirect` is the more familiar spelling and is
 * what external links tend to use. Callers pass whichever they found.
 */
export function safeNextPath(
  raw: string | string[] | undefined,
  fallback: string
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // A backslash is treated as a slash by some browsers when resolving URLs,
  // so `/\evil.example` would escape the site.
  if (value.startsWith("/\\")) return fallback;
  return value;
}
