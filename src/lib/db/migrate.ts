import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Db } from './types'

const DIR = path.join(process.cwd(), 'db', 'migrations')

/** Applies db/migrations/*.sql in name order, each once, each in a transaction. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map(r => r.name))
  const applied: string[] = []
  for (const file of readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    const sql = readFileSync(path.join(DIR, file), 'utf8')
    await db.transaction(async tx => {
      await tx.exec(sql)
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    })
    applied.push(file)
  }
  return applied
}
