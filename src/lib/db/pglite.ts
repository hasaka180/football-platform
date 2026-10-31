import { PGlite, type Transaction } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import type { Db, Row } from './types'

type Queryable = Pick<PGlite, 'query' | 'exec'> | Transaction

function wrap(conn: Queryable, pg: PGlite): Db {
  return {
    async query<T extends Row>(sql: string, params: unknown[] = []) {
      return (await conn.query<T>(sql, params)).rows
    },
    async exec(sql) {
      await conn.exec(sql)
    },
    async transaction(fn) {
      // PGlite has no nested transactions; inside one, keep using it.
      if (conn !== pg) return fn(wrap(conn, pg))
      return pg.transaction(tx => fn(wrap(tx, pg)))
    },
    close: () => pg.close(),
  }
}

/** In-memory Postgres (WASM). Pass a snapshot to start from an ingested copy. */
export async function openPglite(opts: { snapshot?: Blob } = {}): Promise<Db & { dump(): Promise<Blob> }> {
  const pg = await PGlite.create({ extensions: { pg_trgm }, loadDataDir: opts.snapshot })
  return Object.assign(wrap(pg, pg), {
    dump: async () => (await pg.dumpDataDir('gzip')) as Blob,
  })
}
