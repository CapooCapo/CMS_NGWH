import {defineField, defineType} from 'sanity'

export const partner = defineType({
  name: 'partner',
  title: 'Partner',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    // A partner is one shared document rather than one per locale (there is no
    // `language` field and no document-internationalization for this type), so
    // the role is stored per language on the document itself.
    defineField({
      name: 'roleEn',
      title: 'Role (EN)',
      type: 'string',
      description: 'Shown on the English About page.',
    }),
    defineField({
      name: 'roleVi',
      title: 'Role (VI)',
      type: 'string',
      description: 'Shown on the Vietnamese About page.',
    }),
    defineField({
      name: 'role',
      title: 'Role (legacy)',
      type: 'string',
      description:
        'Deprecated single-language role, kept so documents created before ' +
        'Role (EN)/Role (VI) existed still render. Fill in the two fields ' +
        'above instead; this one is only used as a last-resort fallback.',
      readOnly: true,
      hidden: ({value}) => !value,
    }),
    defineField({
      name: 'logo',
      type: 'image',
      options: {hotspot: true},
    }),
  ],
  preview: {
    select: {title: 'name', roleEn: 'roleEn', role: 'role', media: 'logo'},
    prepare({title, roleEn, role, media}) {
      return {title, subtitle: roleEn || role, media}
    },
  },
})
