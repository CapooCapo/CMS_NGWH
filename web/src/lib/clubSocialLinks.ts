/** Existing social platforms supported by the club editor and API. */
export const SOCIAL_LINK_KEYS = ["facebook", "instagram", "youtube", "tiktok"] as const;

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];

export const SOCIAL_LINK_FIELDS = SOCIAL_LINK_KEYS.map((key) => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
}));
