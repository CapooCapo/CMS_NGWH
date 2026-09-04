import {defineConfig} from 'sanity'
import type {Template} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {documentInternationalization} from '@sanity/document-internationalization'
import {schemaTypes} from './schemaTypes'
import {structure, SINGLETON_TYPES, LOCALES} from './src/structure'

const TRANSLATABLE_TYPES = ['newsArticle', 'galleryItem']
const SUPPORTED_LANGUAGES = LOCALES.map((id) => ({
  id,
  title: id === 'en' ? 'English' : 'Vietnamese',
}))

export default defineConfig({
  name: 'default',
  title: 'NGWH',

  projectId: '7o3rvpf2',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    visionTool(),
    documentInternationalization({
      supportedLanguages: SUPPORTED_LANGUAGES,
      schemaTypes: TRANSLATABLE_TYPES,
    }),
  ],

  schema: {
    types: schemaTypes,
    templates: (prev): Template[] => [
      ...prev,
      ...SINGLETON_TYPES.flatMap((schemaType) =>
        LOCALES.map((locale) => ({
          id: `${schemaType}-${locale}`,
          title: `${schemaType} (${locale})`,
          schemaType,
          // Declaring `parameters` keeps this out of the auto-generated
          // "New document" menu — it's only reachable via the fixed-ID
          // singleton link in the custom Structure.
          parameters: [{name: 'language', type: 'string'}],
          value: ({language}: {language: string}) => ({language}),
        })),
      ),
    ],
  },

  document: {
    newDocumentOptions: (prev) =>
      prev.filter((item) => !SINGLETON_TYPES.includes(item.templateId)),
  },
})
