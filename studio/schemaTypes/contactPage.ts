import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Editorial content for the Contact page (REQ-CONTACT-001).
 *
 * Only the *editable* side lives here. Form submissions (REQ-CONTACT-002) are
 * transactional and are persisted in the application database instead.
 */
export const contactPage = defineType({
  name: 'contactPage',
  title: 'Contact Page',
  type: 'document',
  fields: [
    defineField({name: 'language', type: 'string', readOnly: true}),

    // REQ-CONTACT-001 — office info, hotline, support email(s).
    defineField({name: 'officeName', title: 'Office name', type: 'string'}),
    defineField({name: 'address', title: 'Address', type: 'text', rows: 3}),
    defineField({
      name: 'hotline',
      title: 'Hotline',
      type: 'string',
      description: 'REQ-CONTACT-001. Rendered as a tel: link.',
    }),
    defineField({
      name: 'emails',
      title: 'Support email(s)',
      description: 'REQ-CONTACT-001 — one or more addresses, each with a label.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'supportEmail',
          fields: [
            {name: 'label', type: 'string', title: 'Label (e.g. General, Media)'},
            {
              name: 'address',
              type: 'string',
              title: 'Email address',
              validation: (r) =>
                r.required().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {name: 'email'}),
            },
          ],
          preview: {select: {title: 'address', subtitle: 'label'}},
        }),
      ],
    }),
    defineField({
      name: 'officeHours',
      title: 'Office hours',
      type: 'string',
    }),
    defineField({
      name: 'note',
      title: 'Additional information',
      type: 'blockContent',
    }),
    defineField({
      name: 'formIntro',
      title: 'Contact form introduction',
      type: 'text',
      rows: 3,
      description:
        'Shown above the feedback form. REQ-CONTACT-002 is otherwise blocked ' +
        'by OQ-014 (fields and routing undecided).',
    }),
  ],
  preview: {
    select: {language: 'language'},
    prepare({language}) {
      return {title: 'Contact Page', subtitle: language?.toUpperCase() || 'No language'}
    },
  },
})
