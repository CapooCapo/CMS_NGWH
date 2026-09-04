import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-08-28'})

function text(block) {
  return (block?.children || []).map((c) => c.text || '').join('')
}

async function main() {
  for (const id of ['aboutPage-en', 'aboutPage-vi']) {
    const doc = await client.getDocument(id)
    if (!doc) throw new Error(`${id} not found`)

    const blocks = doc.brandStory || []
    if (blocks.length !== 2 || text(blocks[0]) !== doc.vision) {
      console.log(`${id}: no duplicate vision paragraph in brandStory — skipped`)
      continue
    }

    // Drop the leading paragraph that duplicates `vision`; keep the narrative
    // paragraph (and its _key) untouched.
    await client.patch(id).set({brandStory: [blocks[1]]}).commit()
    console.log(`${id}: brandStory reduced to 1 block (${text(blocks[1]).slice(0, 40)}…)`)
  }
}

main().catch((err) => {
  console.error('Patch error:', err)
  process.exit(1)
})
