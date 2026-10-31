import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { getDb } from '@/lib/db/client'

/**
 * Cached reads for pages. Tags match those returned by ingestion
 * (IngestSummary.tags), so a correction revalidates only what it touched.
 */

export type SeasonInfo = {
  id: string
  competition: string
  competitionSlug: string
  season: string
  seasonSlug: string
  sourceName: string
  attribution: string | null
  retrievedAt: string | null
  sourceUpdatedAt: string | null
  matches: number
  finished: number
}

export async function getSeason(competitionSlug: string, seasonSlug: string): Promise<SeasonInfo | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`competition:${competitionSlug}`, `season:${competitionSlug}/${seasonSlug}`)
  const db = await getDb()
  const [row] = await db.query<SeasonInfo>(
    `SELECT cs.id, c.name AS competition, c.slug AS "competitionSlug", s.name AS season, s.slug AS "seasonSlug",
            ds.name AS "sourceName", ds.attribution,
            to_char(cs.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "retrievedAt",
            to_char(cs.source_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "sourceUpdatedAt",
            (SELECT count(*)::int FROM matches m WHERE m.competition_season_id = cs.id) AS matches,
            (SELECT count(*)::int FROM matches m WHERE m.competition_season_id = cs.id AND m.status = 'finished') AS finished
     FROM competition_seasons cs
     JOIN competitions c ON c.id = cs.competition_id
     JOIN seasons s ON s.id = cs.season_id
     JOIN data_sources ds ON ds.code = cs.source_code
     WHERE c.slug = $1 AND s.slug = $2 AND ds.is_production`,
    [competitionSlug, seasonSlug],
  )
  return row ?? null
}

export type StandingRow = {
  position: number
  club: string
  clubSlug: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
  method: 'computed' | 'provider'
}

export async function getStandings(seasonId: string, limit = 100): Promise<StandingRow[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`standings:${seasonId}`)
  const db = await getDb()
  return db.query<StandingRow>(
    `SELECT st.position, coalesce(c.short_name, c.name) AS club, c.slug AS "clubSlug", st.played, st.won, st.drawn, st.lost,
            st.goals_for AS "goalsFor", st.goals_against AS "goalsAgainst", st.points, st.method
     FROM standings st JOIN clubs c ON c.id = st.club_id
     WHERE st.competition_season_id = $1 ORDER BY st.position LIMIT $2`,
    [seasonId, limit],
  )
}

export type ScorerRow = {
  player: string
  playerSlug: string
  club: string
  clubSlug: string
  goals: number
  penaltyGoals: number
  appearances: number
  minutes: number
}

export async function getTopScorers(seasonId: string, limit = 10): Promise<ScorerRow[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`scorers:${seasonId}`)
  const db = await getDb()
  return db.query<ScorerRow>(
    `SELECT p.name AS player, p.slug AS "playerSlug", coalesce(c.short_name, c.name) AS club, c.slug AS "clubSlug",
            s.goals, s.penalty_goals AS "penaltyGoals", s.appearances, s.minutes
     FROM player_season_statistics s JOIN players p ON p.id = s.player_id JOIN clubs c ON c.id = s.club_id
     WHERE s.competition_season_id = $1 AND s.goals > 0
     ORDER BY s.goals DESC, s.minutes ASC, p.name LIMIT $2`,
    [seasonId, limit],
  )
}
