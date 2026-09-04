import {InfoOutlineIcon} from '@sanity/icons/InfoOutline'
import type {StructureBuilder, StructureResolver} from 'sanity/structure'

export const SINGLETON_TYPES = ['homePage', 'aboutPage', 'contactPage']
export const LOCALES = ['vi', 'en']

function createLocalizedSingleton(S: StructureBuilder, typeName: string, title: string) {
  return S.listItem()
    .title(title)
    .icon(InfoOutlineIcon)
    .child(
      S.list()
        .title(title)
        .items(
          LOCALES.map((locale) =>
            S.listItem()
              .title(`${title} (${locale.toUpperCase()})`)
              .child(
                S.document()
                  .schemaType(typeName)
                  .documentId(`${typeName}-${locale}`)
                  .initialValueTemplate(`${typeName}-${locale}`, {language: locale})
                  .title(`${title} (${locale.toUpperCase()})`),
              ),
          ),
        ),
    )
}

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      createLocalizedSingleton(S, 'homePage', 'Home Page'),
      createLocalizedSingleton(S, 'aboutPage', 'About Page'),
      createLocalizedSingleton(S, 'contactPage', 'Contact Page'),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => !SINGLETON_TYPES.includes(item.getId() as string),
      ),
    ])
