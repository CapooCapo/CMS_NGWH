import {defineField, defineType} from 'sanity'

export const newsArticle = defineType({
  name: 'newsArticle',
  title: 'News Article',
  type: 'document',
  fields: [
    defineField({
      name: 'language',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({name: 'title', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'slug', type: 'slug', options: {source: 'title'}, validation: (r) => r.required()}),
    defineField({
      name: 'category',
      type: 'string',
      options: {
        list: [
          {title: 'Tournament News', value: 'tournament-news'},
          {title: 'Inspirational Stories', value: 'inspirational-stories'},
          {title: 'Knowledge & Nutrition', value: 'knowledge-nutrition'},
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({name: 'date', type: 'datetime', validation: (r) => r.required()}),
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: {hotspot: true},
      fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
    }),
    defineField({name: 'body', type: 'blockContent'}),
  ],
  preview: {
    select: {title: 'title', subtitle: 'category', language: 'language', media: 'coverImage'},
    prepare({title, subtitle, language, media}) {
      return {
        title,
        subtitle: [subtitle, language?.toUpperCase()].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
