import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

const MIGRATIONS_DIR = path.join(process.cwd(), "src/server/migrations");

/**
 * Applies any `*.sql` file in `src/server/migrations` that has not been applied
 * yet, in filename order, each inside its own transaction. Applied names are
 * recorded in `schema_migrations`, so re-running is a no-op.
 */
export async function migrate(log: (msg: string) => void = () => {}) {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        log(`  skip    ${file}`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        log(`  applied ${file}`);
        count++;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
    return count;
  } finally {
    client.release();
  }
}
