import postgres from 'postgres'
import type { Db, Row } from './types'

type Sql = postgres.Sql | postgres.TransactionSql

function wrap(sql: Sql, root: postgres.Sql): Db {
  return {
    async query<T extends Row>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[]
    },
    async exec(text) {
      await sql.unsafe(text)
    },
    async transaction(fn) {
      if (sql !== root) return fn(wrap(sql, root))
      return root.begin(tx => fn(wrap(tx, root))) as Promise<never>
    },
    close: () => root.end(),
  }
}

/** Production Postgres (Supabase). `prepare: false` suits Supabase's transaction pooler. */
export function openPostgres(url: string): Db {
  const sql = postgres(url, { prepare: false, max: 5 })
  return wrap(sql, sql)
}
