import { test } from "node:test";
import assert from "node:assert/strict";
import { SOCIAL_LINK_KEYS } from "../src/lib/clubSocialLinks";
import { parseOwnerClub } from "../src/server/validation/ownerClub";

const base = {
  name: "Validation Club",
  province: "Testville",
  foundingYear: null,
  logoUrl: null,
  achievementsEn: null,
  achievementsVi: null,
  contactEmail: null,
  contactPhone: null,
  websiteUrl: null,
};

test("supported social links are validated and preserved as stable keys", () => {
  const socialLinks = Object.fromEntries(
    SOCIAL_LINK_KEYS.map((key) => [key, `https://${key}.example.com/club`])
  );
  const parsed = parseOwnerClub({ ...base, socialLinks });
  assert.deepEqual(parsed.socialLinks, socialLinks);
});

test("invalid and unsupported social links are rejected instead of silently dropped", () => {
  assert.throws(() =>
    parseOwnerClub({ ...base, socialLinks: { facebook: "not-a-url" } })
  );
  assert.throws(() =>
    parseOwnerClub({ ...base, socialLinks: { facebook: "javascript:alert(1)" } })
  );
  assert.throws(() =>
    parseOwnerClub({ ...base, socialLinks: { linkedin: "https://linkedin.example.com/club" } })
  );
});

test("empty optional social-link values remain empty", () => {
  const parsed = parseOwnerClub({
    ...base,
    socialLinks: { facebook: "", instagram: null, youtube: "   " },
  });
  assert.deepEqual(parsed.socialLinks, {});
});

test("an owner form payload may omit achievements", () => {
  const { achievementsEn, achievementsVi } = parseOwnerClub({
    name: "Validation Club",
    province: "Testville",
    socialLinks: {},
  });

  // The owner form deliberately has no achievement controls. The route keeps
  // the stored values when these omitted fields parse as null.
  assert.equal(achievementsEn, null);
  assert.equal(achievementsVi, null);
});
