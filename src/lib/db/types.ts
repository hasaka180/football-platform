export type Row = Record<string, unknown>

/** The minimal surface the app and ingestion need from Postgres. */
export interface Db {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>
  /** Runs a multi-statement script with no parameters (migrations). */
  exec(sql: string): Promise<void>
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): Promise<void>
}
