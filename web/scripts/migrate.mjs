// Standalone migration runner: `npm run db:migrate`
import {readdir, readFile} from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import {databaseConnectionOptions} from '../src/server/db/options.mjs'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set (expected in web/.env.local).')
  process.exit(1)
}
const dir = path.join(process.cwd(), 'src/server/migrations')
const client = new pg.Client(databaseConnectionOptions(url))
await client.connect()
await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
const {rows} = await client.query('SELECT name FROM schema_migrations')
const applied = new Set(rows.map((r) => r.name))
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
let n = 0
for (const file of files) {
  if (applied.has(file)) { console.log(`  skip    ${file}`); continue }
  const sql = await readFile(path.join(dir, file), 'utf8')
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    await client.query('COMMIT')
    console.log(`  applied ${file}`); n++
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(`  FAILED  ${file}: ${e.message}`)
    await client.end(); process.exit(1)
  }
}
console.log(`${n} migration(s) applied.`)
await client.end()
