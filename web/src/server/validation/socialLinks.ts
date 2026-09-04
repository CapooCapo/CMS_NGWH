import "server-only";
import { SOCIAL_LINK_KEYS } from "@/lib/clubSocialLinks";
import type { Validator } from "./validate";

/**
 * Parses the complete social-links object used by the club editor. Empty
 * optional fields are omitted; unsupported platforms and malformed URLs are
 * errors rather than values silently discarded under a successful response.
 */
export function parseSocialLinks(
  value: unknown,
  validator: Validator
): Record<string, string> {
  const links: Record<string, string> = {};
  if (value === undefined || value === null) return links;
  if (typeof value !== "object" || Array.isArray(value)) {
    validator.errors.socialLinks ??= "invalid";
    return links;
  }

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(SOCIAL_LINK_KEYS as readonly string[]).includes(key)) {
      validator.errors.socialLinks ??= "invalidChoice";
      continue;
    }
    if (raw === null || raw === undefined || raw === "") continue;
    if (typeof raw !== "string") {
      validator.errors.socialLinks ??= "invalid";
      continue;
    }
    const input = raw.trim();
    if (!input) continue;
    try {
      const url = new URL(input);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        validator.errors.socialLinks ??= "invalidUrl";
        continue;
      }
      links[key] = url.toString();
    } catch {
      validator.errors.socialLinks ??= "invalidUrl";
    }
  }
  return links;
}
