import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Editorial content for the Home page (REQ-HOME-001..006).
 *
 * A localized singleton like `aboutPage`: one document per locale at the fixed
 * ids `homePage-en` / `homePage-vi`, reachable only through the custom
 * Structure. Operational data on Home (Live & Results, REQ-HOME-005) comes
 * from the application database, not from here.
 */
export const homePage = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    defineField({name: 'language', type: 'string', readOnly: true}),

    // REQ-HOME-001 — Hero. OQ-003 was closed in favour of video, so the
    // carousel is video-first; `poster` doubles as the loading placeholder and
    // the fallback shown when a clip cannot play or the visitor prefers
    // reduced motion.
    defineField({
      name: 'heroSlides',
      title: 'Hero slides (video)',
      description:
        'REQ-HOME-001 / OQ-003 (closed): the hero is a video carousel. Each ' +
        'slide needs a poster image; the video URL is optional so a slide can ' +
        'ship as a still while footage is being sourced.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'heroSlide',
          fields: [
            {name: 'headline', type: 'string', title: 'Headline'},
            {name: 'subheadline', type: 'text', rows: 2, title: 'Sub-headline'},
            {
              name: 'videoUrl',
              type: 'url',
              title: 'Video URL (mp4/webm)',
              description:
                'Direct link to a self-hosted or CDN-hosted clip. Left empty, ' +
                'the poster image is shown instead.',
            },
            {
              name: 'poster',
              type: 'image',
              title: 'Poster / fallback image',
              options: {hotspot: true},
              fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
              validation: (r) => r.required(),
            },
            {name: 'ctaLabel', type: 'string', title: 'CTA label'},
            {
              name: 'ctaHref',
              type: 'string',
              title: 'CTA link',
              description: 'Site-relative path, e.g. /tournaments',
            },
          ],
          preview: {select: {title: 'headline', media: 'poster'}},
        }),
      ],
    }),

    // REQ-HOME-002 — tagline in the hero. Defaults to the brand tagline
    // (REQ-BRAND-003) in the frontend when left blank.
    defineField({
      name: 'tagline',
      title: 'Hero tagline',
      type: 'string',
      description:
        'REQ-HOME-002. Leave empty to use the brand tagline ' +
        '"Where Tomorrow\'s Legends Rise" (REQ-BRAND-003).',
    }),

    // REQ-HOME-003 — short mission overview.
    defineField({
      name: 'missionTitle',
      title: 'Mission section title',
      type: 'string',
    }),
    defineField({
      name: 'missionOverview',
      title: 'Mission overview',
      description: 'REQ-HOME-003 — short overview, not the full About copy.',
      type: 'blockContent',
    }),

    // REQ-HOME-006 — Champions Corner (defending champion).
    defineField({
      name: 'championsCorner',
      title: "Champions Corner",
      description: 'REQ-HOME-006 — the defending champion.',
      type: 'object',
      fields: [
        {name: 'clubName', type: 'string', title: 'Champion club name'},
        {name: 'seasonLabel', type: 'string', title: 'Season won'},
        {name: 'summary', type: 'text', rows: 4, title: 'Summary'},
        {
          name: 'image',
          type: 'image',
          title: 'Image',
          options: {hotspot: true},
          fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
        },
        {
          name: 'clubSlug',
          type: 'string',
          title: 'Club profile slug (optional)',
          description:
            'Links the card to /clubs/<slug> when that club has an approved ' +
            'profile in the application database.',
        },
      ],
    }),
  ],
  preview: {
    select: {language: 'language'},
    prepare({language}) {
      return {title: 'Home Page', subtitle: language?.toUpperCase() || 'No language'}
    },
  },
})
