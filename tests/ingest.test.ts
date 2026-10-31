import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fixture from './fixtures/openfootball-mini.json'
import { openPglite } from '@/lib/db/pglite'
import { migrate } from '@/lib/db/migrate'
import type { Db } from '@/lib/db/types'
import { ingestCompetitionSeason } from '@/lib/ingest/ingest'
import { parseSeason } from '@/lib/providers/openfootball'

let db: Db
const season = () => ({ ...parseSeason(structuredClone(fixture), 'premier-league', '2025-26', null), source: 'dev-fixtures' as const })

beforeAll(async () => {
  db = await openPglite()
  await migrate(db)
})
afterAll(() => db.close())

describe('ingestion', () => {
  it('applies migrations once', async () => {
    expect(await migrate(db)).toEqual([])
  })

  it('imports a season', async () => {
    const s = await ingestCompetitionSeason(db, season())
    expect(s).toMatchObject({ matches: 3, inserted: 3, updated: 0, corrections: 0 })
    const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM players`)
    expect(n).toBe(26) // 14 Northbridge + 12 Eastport squad members
  })

  it('is idempotent', async () => {
    const s = await ingestCompetitionSeason(db, season())
    expect(s).toMatchObject({ inserted: 0, updated: 0, unchanged: 3, corrections: 0 })
    const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM matches`)
    expect(n).toBe(3)
  })

  it('records a provider correction and bumps the data version', async () => {
    const corrected = season()
    corrected.matches[0].score = { home: 3, away: 1 }
    const s = await ingestCompetitionSeason(db, corrected)
    expect(s).toMatchObject({ updated: 1, corrections: 1 })
    const [c] = await db.query(`SELECT field, old_value, new_value FROM data_corrections`)
    expect(c).toEqual({ field: 'home_score', old_value: 2, new_value: 3 })
    const [m] = await db.query(`SELECT data_version, home_score FROM matches WHERE kickoff_on = '2025-08-16'`)
    expect(m).toEqual({ data_version: 2, home_score: 3 })
    await ingestCompetitionSeason(db, season()) // restore
  })

  it('keeps an unplayed match unscored rather than 0-0', async () => {
    const [m] = await db.query(`SELECT status, home_score, away_score, kickoff_at FROM matches WHERE kickoff_on = '2025-08-30'`)
    expect(m).toEqual({ status: 'scheduled', home_score: null, away_score: null, kickoff_at: null })
  })

  it('derives season statistics', async () => {
    const rows = await db.query(
      `SELECT p.name, s.appearances, s.starts, s.sub_appearances, s.unused_sub, s.minutes, s.goals, s.penalty_goals, s.own_goals, s.yellow_cards, s.red_cards
       FROM player_season_statistics s JOIN players p ON p.id = s.player_id WHERE p.name IN ('Ada Okafor', 'Luis Peña', 'Ned Tate', 'Oli Vance') ORDER BY p.name`,
    )
    expect(rows).toEqual([
      { name: 'Ada Okafor', appearances: 2, starts: 2, sub_appearances: 0, unused_sub: 0, minutes: 210, goals: 2, penalty_goals: 0, own_goals: 0, yellow_cards: 0, red_cards: 0 },
      { name: 'Luis Peña', appearances: 2, starts: 2, sub_appearances: 0, unused_sub: 0, minutes: 210, goals: 2, penalty_goals: 1, own_goals: 0, yellow_cards: 0, red_cards: 0 },
      { name: 'Ned Tate', appearances: 0, starts: 0, sub_appearances: 0, unused_sub: 1, minutes: 0, goals: 0, penalty_goals: 0, own_goals: 0, yellow_cards: 0, red_cards: 0 },
      { name: 'Oli Vance', appearances: 2, starts: 2, sub_appearances: 0, unused_sub: 0, minutes: 190, goals: 0, penalty_goals: 0, own_goals: 0, yellow_cards: 1, red_cards: 1 },
    ])
  })

  it('computes standings from finished matches only', async () => {
    const rows = await db.query(
      `SELECT c.name, s.position, s.played, s.won, s.drawn, s.lost, s.goals_for, s.goals_against, s.points
       FROM standings s JOIN clubs c ON c.id = s.club_id ORDER BY s.position`,
    )
    expect(rows).toEqual([
      { name: 'Northbridge FC', position: 1, played: 2, won: 1, drawn: 1, lost: 0, goals_for: 3, goals_against: 2, points: 4 },
      { name: 'Eastport', position: 2, played: 2, won: 0, drawn: 1, lost: 1, goals_for: 2, goals_against: 3, points: 1 },
    ])
  })

  it('logs every job', async () => {
    const jobs = await db.query(`SELECT status FROM ingestion_jobs`)
    expect(jobs.every(j => j.status === 'succeeded')).toBe(true)
  })
})

describe('source ownership', () => {
  it('refuses to mix two sources in one season unless asked to switch', async () => {
    const other = { ...season(), source: 'openfootball' as const }
    await expect(ingestCompetitionSeason(db, other)).rejects.toThrow(/owned by dev-fixtures/)
    const s = await ingestCompetitionSeason(db, other, { switchSource: true })
    expect(s.inserted).toBe(3)
    const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM matches`)
    expect(n).toBe(3) // rebuilt, not duplicated
    const [log] = await db.query(`SELECT action, detail FROM audit_logs`)
    expect(log).toEqual({ action: 'switch-source', detail: { from: 'dev-fixtures', to: 'openfootball', matchesDeleted: 3 } })
  })
})

describe('search', () => {
  it('finds players by typo and partial name, and clubs by name', async () => {
    const { search } = await import('@/lib/search')
    expect((await search(db, 'okafr'))[0]).toMatchObject({ kind: 'player', name: 'Ada Okafor', context: 'Northbridge' })
    expect((await search(db, 'pena'))[0]).toMatchObject({ kind: 'player', name: 'Luis Peña' })
    expect((await search(db, 'eastport'))[0]).toMatchObject({ kind: 'club', name: 'Eastport' })
    expect(await search(db, 'x')).toEqual([])
    expect(await search(db, 'zzzzqqq')).toEqual([])
  })
})
