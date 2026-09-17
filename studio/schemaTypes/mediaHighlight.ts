import {PlayIcon} from '@sanity/icons/Play'
import {defineField, defineType} from 'sanity'

/**
 * A streamed editorial video. The video itself stays with its streaming
 * provider; Sanity stores the context and an accessible poster image.
 */
export const mediaHighlight = defineType({
  name: 'mediaHighlight',
  title: 'Video Highlight',
  type: 'object',
  icon: PlayIcon,
  fields: [
    defineField({
      name: 'editorialKey',
      type: 'string',
      readOnly: true,
      hidden: true,
      description: 'Internal source key for safe editorial imports.',
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
    defineField({
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      description: 'A public YouTube or Vimeo video URL. Video is streamed by its provider.',
      validation: (rule) => rule.required().uri({scheme: ['https']}),
    }),
    defineField({
      name: 'sourceLabel',
      title: 'Source label',
      type: 'string',
      description: 'For example, “WNBA on YouTube”.',
    }),
    defineField({
      name: 'thumbnail',
      title: 'Poster image',
      type: 'image',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          validation: (rule) =>
            rule.required().warning('Describe the visual for visitors who cannot see it.'),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'sourceLabel', media: 'thumbnail'},
  },
})
