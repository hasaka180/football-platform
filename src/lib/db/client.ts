import 'server-only'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Db } from './types'
import { openPglite } from './pglite'

export type { Db, Row } from './types'

/**
 * One database for the process.
 *
 * - `DATABASE_URL` set (production, Supabase): postgres.js against that server.
 * - Otherwise: an in-memory PGlite loaded from the snapshot written by
 *   `npm run ingest` (`.data/snapshot.tar.gz`). Each process gets its own
 *   read-only copy, so parallel build workers never share a data directory.
 */
let db: Promise<Db> | undefined

export function getDb(): Promise<Db> {
  db ??= open()
  return db
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { openPostgres } = await import('./postgres')
    return openPostgres(url)
  }
  const snapshot = path.join(process.cwd(), '.data', 'snapshot.tar.gz')
  if (!existsSync(snapshot)) {
    throw new Error('No database: set DATABASE_URL, or run `npm run ingest` to build the local snapshot.')
  }
  return openPglite({ snapshot: new Blob([readFileSync(snapshot)]) })
}
