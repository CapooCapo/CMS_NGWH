import {defineArrayMember, defineField, defineType} from 'sanity'

export const galleryItem = defineType({
  name: 'galleryItem',
  title: 'Gallery Item',
  type: 'document',
  fields: [
    defineField({
      name: 'language',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'category',
      type: 'string',
      options: {
        list: [
          {title: 'Hall of Glory', value: 'hall-of-glory'},
          {title: 'MVP Spotlight', value: 'mvp-spotlight'},
          {title: 'Behind the Scenes', value: 'behind-the-scenes'},
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({name: 'title', type: 'string', validation: (r) => r.required()}),
    defineField({
      name: 'photos',
      title: 'Photos',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: {hotspot: true},
          fields: [{name: 'alt', type: 'string', title: 'Alternative text'}],
        }),
      ],
    }),
    defineField({name: 'body', type: 'blockContent'}),
  ],
  preview: {
    select: {title: 'title', subtitle: 'category', language: 'language', media: 'photos.0'},
    prepare({title, subtitle, language, media}) {
      return {
        title,
        subtitle: [subtitle, language?.toUpperCase()].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
