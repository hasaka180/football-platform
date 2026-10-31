/**
 * Pulls the configured competition seasons and writes them to the database.
 *
 *   npm run ingest                         # local: builds .data/snapshot.tar.gz
 *   DATABASE_URL=postgres://… npm run ingest   # production Postgres
 *
 * One fetch per competition season per run, never per visitor.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import path from 'node:path'
import { migrate } from '@/lib/db/migrate'
import { openPglite } from '@/lib/db/pglite'
import { openPostgres } from '@/lib/db/postgres'
import type { Db } from '@/lib/db/types'
import { ingestCompetitionSeason } from '@/lib/ingest/ingest'
import { footballData } from '@/lib/providers/football-data'
import { openfootball } from '@/lib/providers/openfootball'
import type { Provider } from '@/lib/providers/types'

// --switch-source: allow a season to move to a different source (see IngestOptions).
const switchSource = process.argv.includes('--switch-source')

// Same .env files Next.js reads (.env.local etc.), so keys never go on the command line.
loadEnvConfig(process.cwd())

const SNAPSHOT = path.join(process.cwd(), '.data', 'snapshot.tar.gz')

async function main() {
  const url = process.env.DATABASE_URL
  let db: Db
  let dump: (() => Promise<Blob>) | undefined
  if (url) {
    db = openPostgres(url)
  } else {
    const pg = await openPglite({ snapshot: existsSync(SNAPSHOT) ? new Blob([readFileSync(SNAPSHOT)]) : undefined })
    db = pg
    dump = pg.dump
  }

  const applied = await migrate(db)
  if (applied.length) console.log(`Migrations applied: ${applied.join(', ')}`)

  // Every metered request is counted per UTC day (admin shows it).
  const fd = footballData({
    onRequest: async () => {
      await db.query(`INSERT INTO api_usage (source_code, day, requests) VALUES ('football-data', current_date, 1)
        ON CONFLICT (source_code, day) DO UPDATE SET requests = api_usage.requests + 1`)
    },
  })
  // The completed season comes from openfootball (lineups and events). The
  // current season prefers football-data.org once a key exists.
  const TARGETS: { provider: Provider; competition: string; season: string }[] = [
    { provider: openfootball, competition: 'premier-league', season: '2025-26' },
    { provider: fd.enabled() ? fd : openfootball, competition: 'premier-league', season: '2026-27' },
    ...(fd.enabled() ? [{ provider: fd, competition: 'champions-league', season: '2026-27' }] : []),
  ]

  let failed = 0
  for (const t of TARGETS) {
    const label = `${t.provider.code} ${t.competition} ${t.season}`
    if (!t.provider.enabled()) {
      console.log(`- ${label}: skipped (provider disabled)`)
      continue
    }
    try {
      const started = Date.now()
      const data = await t.provider.fetchCompetitionSeason(t.competition, t.season)
      const s = await ingestCompetitionSeason(db, data, { switchSource })
      console.log(`✓ ${label}: ${s.matches} matches (${s.inserted} new, ${s.updated} updated, ${s.unchanged} unchanged), ` +
        `${s.corrections} corrections, ${s.warnings} warnings, ${((Date.now() - started) / 1000).toFixed(1)}s`)
    } catch (err) {
      failed++
      console.error(`✗ ${label}: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (dump) {
    mkdirSync(path.dirname(SNAPSHOT), { recursive: true })
    writeFileSync(SNAPSHOT, Buffer.from(await (await dump()).arrayBuffer()))
    console.log(`Snapshot written: ${path.relative(process.cwd(), SNAPSHOT)}`)
  }
  await db.close()
  process.exit(failed ? 1 : 0)
}

main()
