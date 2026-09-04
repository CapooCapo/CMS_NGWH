/**
 * Backfills the bilingual partner role fields.
 *
 *   npx sanity exec scripts/_migrate-partner-roles.mjs --with-user-token
 *
 * For each partner it sets `roleEn` (from the legacy `role`, if not already
 * set) and `roleVi`. The legacy `role` field is deliberately left in place as
 * the query's last-resort fallback. Nothing is created or deleted, and only
 * documents of type `partner` are touched.
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2026-08-28'})

// Vietnamese role copy, keyed by the English role already on the document so
// this does not depend on document ids.
const VI_BY_EN = {
  'Fictional title partner (demo record)': 'Nhà tài trợ danh xưng hư cấu (hồ sơ demo)',
  'Fictional development partner (demo record)': 'Đối tác phát triển hư cấu (hồ sơ demo)',
  'Fictional apparel partner (demo record)': 'Đối tác trang phục thi đấu hư cấu (hồ sơ demo)',
  'Fictional media partner (demo record)': 'Đối tác truyền thông hư cấu (hồ sơ demo)',
}

const partners = await client.fetch(
  `*[_type == "partner"]{_id, name, role, roleEn, roleVi}`
)

let tx = client.transaction()
let planned = 0
const unmapped = []

for (const p of partners) {
  const en = p.roleEn ?? p.role
  const vi = p.roleVi ?? VI_BY_EN[en]
  if (!en) {
    console.log(`  skip ${p._id} — no role to migrate`)
    continue
  }
  if (!vi) {
    unmapped.push(`${p._id} (${en})`)
    continue
  }
  tx = tx.patch(p._id, (patch) => patch.set({roleEn: en, roleVi: vi}))
  planned++
  console.log(`  ${p._id}\n      EN: ${en}\n      VI: ${vi}`)
}

if (unmapped.length) {
  console.error(`\nNo Vietnamese copy for: ${unmapped.join(', ')}`)
  console.error('Add it to VI_BY_EN and re-run; nothing has been written.')
  process.exit(1)
}

if (planned === 0) {
  console.log('\nNothing to do.')
} else {
  await tx.commit()
  console.log(`\nPatched ${planned} partner document(s).`)
}
