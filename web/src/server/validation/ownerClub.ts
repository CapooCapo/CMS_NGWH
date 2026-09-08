import "server-only";
import { Validator } from "./validate";
import { parseSocialLinks } from "./socialLinks";

/**
 * The subset of `ClubInput` (see `repositories/clubs.ts`) a Club Owner may
 * edit themselves. Deliberately excludes `slug` (URL identity — an admin
 * concern) and `isApproved` (BR-001 publish state — an owner must never be
 * able to self-approve or unpublish their own club). The route handler merges
 * this onto the club's existing `slug`/`isApproved` before calling
 * `updateClub`, so those two fields are physically impossible for an owner
 * request to change, not just excluded by convention.
 *
 * Field-level rules are identical to `validation/admin.ts`'s `parseClub` —
 * kept in a separate file, not shared, so the two security domains (staff vs
 * Club Owner) never import from each other's validator.
 */
export type OwnerClubUpdate = {
  name: string;
  province: string;
  foundingYear: number | null;
  logoUrl: string | null;
  achievementsEn: string | null;
  achievementsVi: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
};

export function parseOwnerClub(body: Record<string, unknown>): OwnerClubUpdate {
  const v = new Validator(body);
  v.only(["name", "province", "foundingYear", "logoUrl", "achievementsEn", "achievementsVi", "contactEmail", "contactPhone", "websiteUrl", "socialLinks"]);
  const input: OwnerClubUpdate = {
    name: v.string("name", { required: true, min: 2, max: 200 }) ?? "",
    province: v.string("province", { required: true, min: 2, max: 160 }) ?? "",
    foundingYear: v.integer("foundingYear", { min: 1800, max: 2200 }),
    logoUrl: v.url("logoUrl"),
    achievementsEn: v.string("achievementsEn", { max: 4000 }),
    achievementsVi: v.string("achievementsVi", { max: 4000 }),
    contactEmail: v.email("contactEmail"),
    contactPhone: v.phone("contactPhone"),
    websiteUrl: v.url("websiteUrl"),
    socialLinks: {},
  };

  input.socialLinks = parseSocialLinks(body.socialLinks, v);

  v.assert();
  return input;
}
