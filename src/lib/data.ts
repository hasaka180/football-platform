import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { getDb } from '@/lib/db/client'

/**
 * Cached reads for entity pages. Only production sources are read
 * (data_sources.is_production), so development fixtures can never appear.
 */

const PROD = `EXISTS (SELECT 1 FROM data_sources ds WHERE ds.code = cs.source_code AND ds.is_production)`

// ── Players ──────────────────────────────────────────────────────────────────

export type PlayerSeason = {
  csId: string
  competition: string
  competitionSlug: string
  season: string
  seasonSlug: string
  club: string
  clubSlug: string
  appearances: number
  starts: number
  subAppearances: number
  unusedSub: number
  minutes: number
  goals: number
  penaltyGoals: number
  ownGoals: number
  yellowCards: number
  redCards: number
  /** The club's league goals that season, for share-of-goals context. */
  clubGoals: number | null
  clubPosition: number | null
  clubMatches: number
}

/** A freely licensed photo and the attribution its licence requires. */
export type PlayerPhoto = { url: string; width: number; height: number; artist: string; licence: string; licenceUrl: string | null; pageUrl: string }

export type Player = { id: string; slug: string; name: string; photo: PlayerPhoto | null; seasons: PlayerSeason[] }

export async function getPlayer(slug: string): Promise<Player | null> {
  'use cache'
  cacheLife('hours')
  const db = await getDb()
  const [p] = await db.query<{ id: string; slug: string; name: string }>(`SELECT id, slug, name FROM players WHERE slug = $1`, [slug])
  if (!p) return null
  cacheTag(`player:${p.id}`)
  const seasons = await db.query<PlayerSeason>(
    `SELECT cs.id AS "csId", c.name AS competition, c.slug AS "competitionSlug", s.name AS season, s.slug AS "seasonSlug",
            coalesce(cl.short_name, cl.name) AS club, cl.slug AS "clubSlug",
            ps.appearances, ps.starts, ps.sub_appearances AS "subAppearances", ps.unused_sub AS "unusedSub", ps.minutes,
            ps.goals, ps.penalty_goals AS "penaltyGoals", ps.own_goals AS "ownGoals", ps.yellow_cards AS "yellowCards", ps.red_cards AS "redCards",
            st.goals_for AS "clubGoals", st.position AS "clubPosition",
            (SELECT count(*)::int FROM matches m WHERE m.competition_season_id = cs.id AND m.status = 'finished'
               AND (m.home_club_id = cl.id OR m.away_club_id = cl.id)) AS "clubMatches"
     FROM player_season_statistics ps
     JOIN competition_seasons cs ON cs.id = ps.competition_season_id
     JOIN competitions c ON c.id = cs.competition_id
     JOIN seasons s ON s.id = cs.season_id
     JOIN clubs cl ON cl.id = ps.club_id
     LEFT JOIN standings st ON st.competition_season_id = cs.id AND st.club_id = cl.id
     WHERE ps.player_id = $1 AND ${PROD}
     ORDER BY s.slug DESC, ps.minutes DESC`,
    [p.id],
  )
  const [photo] = await db.query<PlayerPhoto>(
    `SELECT thumb_url AS url, thumb_width AS width, thumb_height AS height, artist, licence, licence_url AS "licenceUrl", page_url AS "pageUrl"
     FROM player_media WHERE player_id = $1`,
    [p.id],
  )
  return { ...p, photo: photo ?? null, seasons }
}

export type CreditRow = PlayerPhoto & { player: string; playerSlug: string }

/** Every photo shown on the site, for the credits page. */
export async function getPhotoCredits(): Promise<CreditRow[]> {
  'use cache'
  cacheLife('days')
  const db = await getDb()
  return db.query<CreditRow>(
    `SELECT p.name AS player, p.slug AS "playerSlug", pm.thumb_url AS url, pm.thumb_width AS width, pm.thumb_height AS height,
            pm.artist, pm.licence, pm.licence_url AS "licenceUrl", pm.page_url AS "pageUrl"
     FROM player_media pm JOIN players p ON p.id = pm.player_id ORDER BY p.name`,
  )
}

export type MatchLogRow = {
  matchSlug: string
  date: string
  round: string | null
  venue: 'H' | 'A'
  opponent: string
  opponentSlug: string
  goalsFor: number | null
  goalsAgainst: number | null
  role: 'starter' | 'bench'
  minuteOn: number | null
  minuteOff: number | null
  minutes: number | null
  goals: number
  penaltyGoals: number
  ownGoals: number
  yellowCards: number
  redCards: number
}

export async function getPlayerMatchLog(playerId: string, csId: string): Promise<MatchLogRow[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`player:${playerId}`, `season-matches:${csId}`)
  const db = await getDb()
  return db.query<MatchLogRow>(
    `SELECT m.slug AS "matchSlug", m.kickoff_on::text AS date, m.round,
            CASE WHEN m.home_club_id = l.club_id THEN 'H' ELSE 'A' END AS venue,
            coalesce(o.short_name, o.name) AS opponent, o.slug AS "opponentSlug",
            CASE WHEN m.home_club_id = l.club_id THEN m.home_score ELSE m.away_score END AS "goalsFor",
            CASE WHEN m.home_club_id = l.club_id THEN m.away_score ELSE m.home_score END AS "goalsAgainst",
            l.role, s.minute_on AS "minuteOn", s.minute_off AS "minuteOff", s.minutes,
            coalesce(s.goals, 0) AS goals, coalesce(s.penalty_goals, 0) AS "penaltyGoals", coalesce(s.own_goals, 0) AS "ownGoals",
            coalesce(s.yellow_cards, 0) AS "yellowCards", coalesce(s.red_cards, 0) AS "redCards"
     FROM match_lineups l
     JOIN matches m ON m.id = l.match_id
     JOIN clubs o ON o.id = CASE WHEN m.home_club_id = l.club_id THEN m.away_club_id ELSE m.home_club_id END
     LEFT JOIN player_match_statistics s ON s.match_id = l.match_id AND s.player_id = l.player_id
     WHERE l.player_id = $1 AND m.competition_season_id = $2
     ORDER BY m.kickoff_on, m.kickoff_at NULLS LAST`,
    [playerId, csId],
  )
}

// ── Clubs ────────────────────────────────────────────────────────────────────

export type ClubSeason = { csId: string; competition: string; competitionSlug: string; season: string; seasonSlug: string; hasLineups: boolean }

export type Club = { id: string; slug: string; name: string; shortName: string; seasons: ClubSeason[] }

export async function getClub(slug: string): Promise<Club | null> {
  'use cache'
  cacheLife('hours')
  const db = await getDb()
  const [c] = await db.query<{ id: string; slug: string; name: string; shortName: string }>(
    `SELECT id, slug, name, coalesce(short_name, name) AS "shortName" FROM clubs WHERE slug = $1`, [slug])
  if (!c) return null
  cacheTag(`club:${c.id}`)
  const seasons = await db.query<ClubSeason>(
    `SELECT DISTINCT cs.id AS "csId", co.name AS competition, co.slug AS "competitionSlug", s.name AS season, s.slug AS "seasonSlug",
            bool_or(m.has_lineups) OVER (PARTITION BY cs.id) AS "hasLineups"
     FROM matches m JOIN competition_seasons cs ON cs.id = m.competition_season_id
     JOIN competitions co ON co.id = cs.competition_id JOIN seasons s ON s.id = cs.season_id
     WHERE (m.home_club_id = $1 OR m.away_club_id = $1) AND ${PROD}
     ORDER BY "seasonSlug" DESC`,
    [c.id],
  )
  return { ...c, seasons }
}

export type SquadRow = {
  player: string
  playerSlug: string
  appearances: number
  starts: number
  minutes: number
  goals: number
  penaltyGoals: number
  yellowCards: number
  redCards: number
}

export async function getSquad(clubId: string, csId: string): Promise<SquadRow[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`club:${clubId}`, `season-matches:${csId}`)
  const db = await getDb()
  return db.query<SquadRow>(
    `SELECT p.name AS player, p.slug AS "playerSlug", ps.appearances, ps.starts, ps.minutes, ps.goals,
            ps.penalty_goals AS "penaltyGoals", ps.yellow_cards AS "yellowCards", ps.red_cards AS "redCards"
     FROM player_season_statistics ps JOIN players p ON p.id = ps.player_id
     WHERE ps.club_id = $1 AND ps.competition_season_id = $2 AND ps.appearances > 0
     ORDER BY ps.minutes DESC, p.name`,
    [clubId, csId],
  )
}

// ── Matches ──────────────────────────────────────────────────────────────────

export type MatchRow = {
  slug: string
  date: string
  kickoffAt: string | null
  round: string | null
  status: string
  home: string
  homeSlug: string
  away: string
  awaySlug: string
  homeScore: number | null
  awayScore: number | null
}

const MATCH_COLS = `m.slug, m.kickoff_on::text AS date,
  to_char(m.kickoff_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "kickoffAt", m.round, m.status,
  coalesce(h.short_name, h.name) AS home, h.slug AS "homeSlug", coalesce(a.short_name, a.name) AS away, a.slug AS "awaySlug",
  m.home_score AS "homeScore", m.away_score AS "awayScore"`

export async function getSeasonMatches(csId: string, clubId?: string): Promise<MatchRow[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`season-matches:${csId}`)
  const db = await getDb()
  return db.query<MatchRow>(
    `SELECT ${MATCH_COLS}
     FROM matches m JOIN clubs h ON h.id = m.home_club_id JOIN clubs a ON a.id = m.away_club_id
     WHERE m.competition_season_id = $1 AND ($2::uuid IS NULL OR m.home_club_id = $2 OR m.away_club_id = $2)
     ORDER BY m.kickoff_on, m.kickoff_at NULLS LAST, h.name`,
    [csId, clubId ?? null],
  )
}

export type MatchDetail = MatchRow & {
  id: string
  csId: string
  competition: string
  competitionSlug: string
  season: string
  seasonSlug: string
  homeScoreHt: number | null
  awayScoreHt: number | null
  extraTime: boolean | null
  homePenalties: number | null
  awayPenalties: number | null
  venue: string | null
  attendance: number | null
  referee: string | null
  hasLineups: boolean
  sourceName: string
  sourceUpdatedAt: string | null
  lineups: { side: 'home' | 'away'; player: string; playerSlug: string; role: 'starter' | 'bench'; captain: boolean; minuteOn: number | null; minuteOff: number | null; minutes: number | null }[]
  events: { seq: number; side: 'home' | 'away'; type: string; minute: number; added: number | null; player: string | null; playerSlug: string | null; related: string | null; relatedSlug: string | null }[]
}

export async function getMatch(slug: string): Promise<MatchDetail | null> {
  'use cache'
  cacheLife('hours')
  const db = await getDb()
  const [m] = await db.query<Omit<MatchDetail, 'lineups' | 'events'>>(
    `SELECT ${MATCH_COLS}, m.id, cs.id AS "csId", co.name AS competition, co.slug AS "competitionSlug", s.name AS season, s.slug AS "seasonSlug",
            m.home_score_ht AS "homeScoreHt", m.away_score_ht AS "awayScoreHt", m.went_to_extra_time AS "extraTime",
            m.home_penalties AS "homePenalties", m.away_penalties AS "awayPenalties", m.venue, m.attendance, m.referee,
            m.has_lineups AS "hasLineups", ds.name AS "sourceName",
            to_char(cs.source_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "sourceUpdatedAt"
     FROM matches m JOIN clubs h ON h.id = m.home_club_id JOIN clubs a ON a.id = m.away_club_id
     JOIN competition_seasons cs ON cs.id = m.competition_season_id JOIN competitions co ON co.id = cs.competition_id
     JOIN seasons s ON s.id = cs.season_id JOIN data_sources ds ON ds.code = m.source_code
     WHERE m.slug = $1 AND ds.is_production`,
    [slug],
  )
  if (!m) return null
  cacheTag(`match:${m.id}`)
  const [lineups, events] = await Promise.all([
    db.query<MatchDetail['lineups'][number]>(
      `SELECT CASE WHEN l.club_id = mt.home_club_id THEN 'home' ELSE 'away' END AS side, p.name AS player, p.slug AS "playerSlug",
              l.role, l.is_captain AS captain, s.minute_on AS "minuteOn", s.minute_off AS "minuteOff", s.minutes
       FROM match_lineups l JOIN matches mt ON mt.id = l.match_id JOIN players p ON p.id = l.player_id
       LEFT JOIN player_match_statistics s ON s.match_id = l.match_id AND s.player_id = l.player_id
       WHERE l.match_id = $1 ORDER BY l.role DESC, s.minute_on NULLS LAST, p.name`,
      [m.id],
    ),
    db.query<MatchDetail['events'][number]>(
      `SELECT e.seq, CASE WHEN e.club_id = mt.home_club_id THEN 'home' ELSE 'away' END AS side, e.type, e.minute, e.added_minute AS added,
              coalesce(p.name, e.player_name) AS player, p.slug AS "playerSlug", r.name AS related, r.slug AS "relatedSlug"
       FROM match_events e JOIN matches mt ON mt.id = e.match_id
       LEFT JOIN players p ON p.id = e.player_id LEFT JOIN players r ON r.id = e.related_player_id
       WHERE e.match_id = $1 ORDER BY e.seq`,
      [m.id],
    ),
  ])
  return { ...m, lineups, events }
}

// ── Competitions ─────────────────────────────────────────────────────────────

export type CompetitionSeason = {
  csId: string
  season: string
  seasonSlug: string
  matches: number
  finished: number
  withLineups: number
  sourceName: string
  retrievedAt: string | null
  sourceUpdatedAt: string | null
  lastResultOn: string | null
}

export type Competition = { id: string; slug: string; name: string; country: string | null; seasons: CompetitionSeason[] }

export async function getCompetition(slug: string): Promise<Competition | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`competition:${slug}`)
  const db = await getDb()
  const [c] = await db.query<{ id: string; slug: string; name: string; country: string | null }>(
    `SELECT id, slug, name, country FROM competitions WHERE slug = $1`, [slug])
  if (!c) return null
  const seasons = await db.query<CompetitionSeason>(
    `SELECT cs.id AS "csId", s.name AS season, s.slug AS "seasonSlug",
            count(m.id)::int AS matches, count(m.id) FILTER (WHERE m.status = 'finished')::int AS finished,
            count(m.id) FILTER (WHERE m.has_lineups)::int AS "withLineups", ds.name AS "sourceName",
            to_char(cs.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "retrievedAt",
            to_char(cs.source_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "sourceUpdatedAt",
            max(m.kickoff_on) FILTER (WHERE m.status = 'finished')::text AS "lastResultOn"
     FROM competition_seasons cs JOIN seasons s ON s.id = cs.season_id JOIN data_sources ds ON ds.code = cs.source_code
     LEFT JOIN matches m ON m.competition_season_id = cs.id
     WHERE cs.competition_id = $1 AND ds.is_production
     GROUP BY cs.id, s.name, s.slug, ds.name ORDER BY s.slug DESC`,
    [c.id],
  )
  return { ...c, seasons }
}

// ── Static params and sitemap ────────────────────────────────────────────────

export async function listSlugs(): Promise<{ players: string[]; clubs: string[]; matches: string[]; indexableMatches: string[]; competitions: { slug: string; seasons: string[] }[] }> {
  'use cache'
  cacheLife('hours')
  const db = await getDb()
  const [players, clubs, matches, indexable, comps] = await Promise.all([
    db.query<{ slug: string }>(`SELECT DISTINCT p.slug FROM players p JOIN player_season_statistics s ON s.player_id = p.id WHERE s.appearances > 0 ORDER BY 1`),
    db.query<{ slug: string }>(`SELECT slug FROM clubs ORDER BY 1`),
    db.query<{ slug: string }>(`SELECT m.slug FROM matches m JOIN data_sources ds ON ds.code = m.source_code WHERE ds.is_production ORDER BY 1`),
    db.query<{ slug: string }>(`SELECT m.slug FROM matches m JOIN data_sources ds ON ds.code = m.source_code WHERE ds.is_production AND m.status = 'finished' AND m.has_lineups ORDER BY 1`),
    db.query<{ slug: string; seasons: string[] }>(
      `SELECT c.slug, array_agg(s.slug ORDER BY s.slug DESC) AS seasons FROM competitions c
       JOIN competition_seasons cs ON cs.competition_id = c.id JOIN seasons s ON s.id = cs.season_id GROUP BY c.slug`),
  ])
  return { players: players.map(r => r.slug), clubs: clubs.map(r => r.slug), matches: matches.map(r => r.slug), indexableMatches: indexable.map(r => r.slug), competitions: comps }
}

/**
 * Today's date (UTC), cached for an hour. Pages compare fixture dates against
 * it; reading the clock inside a prerender is otherwise disallowed.
 */
export async function getToday(): Promise<string> {
  'use cache'
  cacheLife('hours')
  return new Date().toISOString().slice(0, 10)
}

// ── Hero data (homepage) ─────────────────────────────────────────────────────

/** Cumulative league points after each match, for sparklines. */
export async function getPointsProgression(csId: string, clubSlug: string): Promise<number[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`season-matches:${csId}`)
  const db = await getDb()
  const rows = await db.query<{ pts: number }>(
    `SELECT CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END AS pts FROM (
       SELECT m.kickoff_on, CASE WHEN m.home_club_id = c.id THEN m.home_score ELSE m.away_score END AS gf,
              CASE WHEN m.home_club_id = c.id THEN m.away_score ELSE m.home_score END AS ga
       FROM matches m JOIN clubs c ON c.slug = $2 AND (m.home_club_id = c.id OR m.away_club_id = c.id)
       WHERE m.competition_season_id = $1 AND m.status = 'finished'
     ) x ORDER BY kickoff_on`,
    [csId, clubSlug],
  )
  let total = 0
  return rows.map(r => (total += r.pts))
}

/** A player's cumulative goals across their club's matches, in date order. */
export async function getGoalProgression(csId: string, playerSlug: string): Promise<number[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(`season-matches:${csId}`)
  const db = await getDb()
  const rows = await db.query<{ goals: number }>(
    `SELECT coalesce(s.goals, 0) AS goals
     FROM matches m
     JOIN players p ON p.slug = $2
     JOIN player_club_memberships pm ON pm.player_id = p.id AND pm.competition_season_id = $1
     LEFT JOIN player_match_statistics s ON s.match_id = m.id AND s.player_id = p.id
     WHERE m.competition_season_id = $1 AND m.status = 'finished' AND (m.home_club_id = pm.club_id OR m.away_club_id = pm.club_id)
     ORDER BY m.kickoff_on`,
    [csId, playerSlug],
  )
  let total = 0
  return rows.map(r => (total += r.goals))
}

/** "Match of the season": the highest-scoring meeting between two top-four clubs. */
export async function getFeaturedMatchSlug(csId: string): Promise<string | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`season-matches:${csId}`)
  const db = await getDb()
  const [row] = await db.query<{ slug: string }>(
    `SELECT m.slug FROM matches m
     JOIN standings h ON h.competition_season_id = m.competition_season_id AND h.club_id = m.home_club_id AND h.position <= 4
     JOIN standings a ON a.competition_season_id = m.competition_season_id AND a.club_id = m.away_club_id AND a.position <= 4
     WHERE m.competition_season_id = $1 AND m.status = 'finished' AND m.has_lineups
     ORDER BY m.home_score + m.away_score DESC, m.kickoff_on DESC LIMIT 1`,
    [csId],
  )
  return row?.slug ?? null
}
