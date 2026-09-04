/**
 * Normalises heading levels in DEMO article bodies.
 *
 *   npx sanity exec scripts/_fix-demo-heading-levels.mjs --with-user-token
 *
 * The seeded demo articles used the `h3` block style for their top-level body
 * sections. Rendered under the page `h1`, that produces an h1 -> h3 jump in the
 * document outline, which is a heading-hierarchy defect for screen-reader
 * users. Top-level body sections should be `h2`.
 *
 * Touches only documents whose id starts with `demo-`, and only body blocks
 * whose style is exactly `h3`. Nothing else is modified, nothing is deleted.
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-08-28'})

const docs = await client.fetch(
  `*[_id match "demo-*" && _type in ["newsArticle","galleryItem"] && defined(body)]{_id, body}`
)

let changedDocs = 0
let changedBlocks = 0

for (const doc of docs) {
  const body = doc.body ?? []
  let touched = false
  const next = body.map((block) => {
    if (block?._type === 'block' && block.style === 'h3') {
      touched = true
      changedBlocks++
      return {...block, style: 'h2'}
    }
    return block
  })
  if (!touched) continue
  await client.patch(doc._id).set({body: next}).commit()
  changedDocs++
  console.log(`  ${doc._id}: h3 -> h2`)
}

console.log(`\n${changedBlocks} block(s) across ${changedDocs} document(s) updated.`)
