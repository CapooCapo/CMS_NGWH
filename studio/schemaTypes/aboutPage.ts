import {defineArrayMember, defineField, defineType} from 'sanity'

export const aboutPage = defineType({
  name: 'aboutPage',
  title: 'About Page',
  type: 'document',
  fields: [
    defineField({
      name: 'language',
      type: 'string',
      readOnly: true,
    }),
    defineField({name: 'brandStory', title: 'Brand Story', type: 'blockContent'}),
    defineField({name: 'vision', title: 'Vision', type: 'text'}),
    defineField({name: 'mission', title: 'Mission', type: 'text'}),
    defineField({
      name: 'tournamentSystem',
      title: 'Tournament System',
      description:
        'Standards/tech/referee/international copy is pending confirmation (OQ-006) — leave generic until resolved.',
      type: 'blockContent',
    }),
    defineField({
      name: 'organizerAndPartners',
      title: 'Organizer & Partners',
      type: 'blockContent',
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: {hotspot: true},
          fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
        }),
      ],
    }),
    defineField({
      name: 'partners',
      title: 'Partners',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'partner'}]})],
    }),
  ],
  preview: {
    select: {language: 'language'},
    prepare({language}) {
      return {
        title: 'About Page',
        subtitle: language?.toUpperCase() || 'No language',
      }
    },
  },
})
