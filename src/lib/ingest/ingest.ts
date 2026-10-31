import { clubAliases } from '@/lib/club-aliases'
import type { Db } from '@/lib/db/types'
import { normalizeClubName, normalizeName, slugify } from '@/lib/names'
import type { NClub, NCompetitionSeason, NMatch, NPlayer } from '@/lib/providers/types'
import { playerMatchLines } from '@/lib/stats/derive'

export type IngestSummary = {
  jobId: string
  target: string
  matches: number
  inserted: number
  updated: number
  unchanged: number
  corrections: number
  warnings: number
  /** Cache tags whose data changed, for revalidateTag. */
  tags: string[]
}

type Ctx = { tx: Db; source: string; jobId: string; csId: string; clubs: Map<string, string>; players: Map<string, string> }

/**
 * Writes one competition season into the database. Idempotent: running it
 * twice with the same input changes nothing. A changed score, status or event
 * list is recorded in data_corrections, and the match's data_version goes up.
 */
export class SourceConflict extends Error {}

/**
 * Options. `switchSource`: a competition season belongs to one source at a
 * time, because two sources identify matches differently and merging them
 * needs reconciliation rules we don't have yet. Moving a season to another
 * source deletes its matches and rebuilds them, so it must be asked for.
 */
export type IngestOptions = { now?: Date; switchSource?: boolean }

export async function ingestCompetitionSeason(db: Db, data: NCompetitionSeason, opts: IngestOptions = {}): Promise<IngestSummary> {
  const now = opts.now ?? new Date()
  const target = `${data.competition.key}/${data.season.key}`
  const [{ id: jobId }] = await db.query<{ id: string }>(
    `INSERT INTO ingestion_jobs (source_code, kind, target, status) VALUES ($1, 'competition-season', $2, 'running') RETURNING id`,
    [data.source, target],
  )
  try {
    const summary = await db.transaction(tx => write(tx, data, jobId, target, now, Boolean(opts.switchSource)))
    await db.query(`UPDATE ingestion_jobs SET status = 'succeeded', finished_at = now(), summary = $2 WHERE id = $1`, [jobId, JSON.stringify(summary)])
    return summary
  } catch (err) {
    await db.query(`UPDATE ingestion_jobs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1`, [jobId, String(err)])
    throw err
  }
}

async function write(tx: Db, data: NCompetitionSeason, jobId: string, target: string, now: Date, switchSource: boolean): Promise<IngestSummary> {
  const c = data.competition
  const [{ id: compId }] = await tx.query<{ id: string }>(
    `INSERT INTO competitions (slug, name, short_name, country, kind) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, short_name = EXCLUDED.short_name RETURNING id`,
    [c.key, c.name, c.shortName, c.country, c.kind],
  )
  const s = data.season
  const [{ id: seasonId }] = await tx.query<{ id: string }>(
    `INSERT INTO seasons (slug, name, starts_on, ends_on) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET starts_on = LEAST(seasons.starts_on, EXCLUDED.starts_on), ends_on = GREATEST(seasons.ends_on, EXCLUDED.ends_on)
     RETURNING id`,
    [s.key, s.name, s.startsOn, s.endsOn],
  )
  const [owner] = await tx.query<{ id: string; source_code: string; n: number }>(
    `SELECT cs.id, cs.source_code, (SELECT count(*)::int FROM matches m WHERE m.competition_season_id = cs.id) AS n
     FROM competition_seasons cs WHERE cs.competition_id = $1 AND cs.season_id = $2`,
    [compId, seasonId],
  )
  if (owner && owner.source_code !== data.source && owner.n > 0) {
    if (!switchSource) {
      throw new SourceConflict(`${target} is owned by ${owner.source_code}; pass switchSource to rebuild it from ${data.source}`)
    }
    for (const t of ['standings', 'player_season_statistics', 'player_club_memberships', 'matches']) {
      await tx.query(`DELETE FROM ${t} WHERE competition_season_id = $1`, [owner.id])
    }
    await tx.query(`DELETE FROM provider_entity_mappings WHERE entity_type = 'match' AND entity_id NOT IN (SELECT id FROM matches)`)
    // Players who now have no data anywhere (aliases cascade).
    await tx.query(
      `DELETE FROM players p WHERE NOT EXISTS (SELECT 1 FROM match_lineups l WHERE l.player_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM match_events e WHERE e.player_id = p.id OR e.related_player_id = p.id)`,
    )
    await tx.query(`DELETE FROM provider_entity_mappings WHERE entity_type = 'player' AND entity_id NOT IN (SELECT id FROM players)`)
    await tx.query(
      `INSERT INTO audit_logs (actor, action, entity_type, entity_id, detail) VALUES ('ingest', 'switch-source', 'competition_season', $1, $2)`,
      [owner.id, JSON.stringify({ from: owner.source_code, to: data.source, matchesDeleted: owner.n })],
    )
  }
  const [{ id: csId }] = await tx.query<{ id: string }>(
    `INSERT INTO competition_seasons (competition_id, season_id, source_code, retrieved_at, source_updated_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (competition_id, season_id) DO UPDATE SET source_code = EXCLUDED.source_code, retrieved_at = EXCLUDED.retrieved_at, source_updated_at = EXCLUDED.source_updated_at
     RETURNING id`,
    [compId, seasonId, data.source, now.toISOString(), data.sourceUpdatedAt],
  )

  const ctx: Ctx = { tx, source: data.source, jobId, csId, clubs: new Map(), players: new Map() }
  const result = { inserted: 0, updated: 0, unchanged: 0, corrections: 0 }
  const tags = new Set<string>([`competition:${c.key}`, `season:${c.key}/${s.key}`])

  for (const m of data.matches) {
    const outcome = await writeMatch(ctx, m, now)
    result[outcome.kind]++
    result.corrections += outcome.corrections
    if (outcome.kind !== 'unchanged') {
      tags.add(`match:${outcome.id}`)
      for (const id of outcome.clubIds) tags.add(`club:${id}`)
      for (const id of outcome.playerIds) tags.add(`player:${id}`)
    }
  }

  for (const w of data.warnings) {
    await tx.query(`INSERT INTO ingestion_failures (job_id, entity_ref, reason) VALUES ($1, $2, $3)`, [jobId, w.ref, w.reason])
  }
  await rebuildSeasonStats(tx, csId, now)
  await rebuildStandings(tx, csId, data.source, now)

  return { jobId, target, matches: data.matches.length, ...result, warnings: data.warnings.length, tags: [...tags] }
}

// ── Entity resolution ────────────────────────────────────────────────────────

async function mapped(tx: Db, source: string, type: string, key: string): Promise<string | undefined> {
  const [row] = await tx.query<{ entity_id: string }>(
    `SELECT entity_id FROM provider_entity_mappings WHERE source_code = $1 AND entity_type = $2 AND provider_key = $3`,
    [source, type, key],
  )
  return row?.entity_id
}

async function addMapping(tx: Db, source: string, type: string, key: string, id: string) {
  await tx.query(
    `INSERT INTO provider_entity_mappings (source_code, entity_type, provider_key, entity_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [source, type, key, id],
  )
}

/** A slug not yet used in `table`, trying each candidate then numbered variants. */
async function freeSlug(tx: Db, table: 'clubs' | 'players' | 'matches', candidates: string[]): Promise<string> {
  for (const slug of candidates) {
    const [taken] = await tx.query(`SELECT 1 FROM ${table} WHERE slug = $1`, [slug])
    if (!taken) return slug
  }
  for (let n = 2; ; n++) {
    const slug = `${candidates[0]}-${n}`
    const [taken] = await tx.query(`SELECT 1 FROM ${table} WHERE slug = $1`, [slug])
    if (!taken) return slug
  }
}

async function resolveClub(ctx: Ctx, club: NClub): Promise<string> {
  const cached = ctx.clubs.get(club.providerKey)
  if (cached) return cached
  let id = await mapped(ctx.tx, ctx.source, 'club', club.providerKey)
  if (!id) {
    // Another source may already know this club under the same name.
    const [byAlias] = await ctx.tx.query<{ club_id: string }>(`SELECT club_id FROM club_aliases WHERE normalized = $1`, [normalizeClubName(club.name)])
    id = byAlias?.club_id
    if (!id) {
      const shortName = club.name.replace(/^AFC\s+|\s+(FC|AFC)$/gi, '')
      const slug = await freeSlug(ctx.tx, 'clubs', [slugify(shortName)])
      ;[{ id }] = await ctx.tx.query<{ id: string }>(`INSERT INTO clubs (slug, name, short_name) VALUES ($1, $2, $3) RETURNING id`, [slug, club.name, shortName])
    }
    await addMapping(ctx.tx, ctx.source, 'club', club.providerKey, id)
    await ctx.tx.query(`INSERT INTO club_aliases (club_id, alias, normalized) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [id, club.name, normalizeClubName(club.name)])
  }
  for (const alias of clubAliases(club.name)) {
    await ctx.tx.query(`INSERT INTO club_aliases (club_id, alias, normalized) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [id, alias, normalizeClubName(alias)])
  }
  ctx.clubs.set(club.providerKey, id)
  return id
}

/**
 * A player is only ever matched by provider key. A new key creates a new
 * player, even if the name already exists at another club: two people can
 * share a name, and a transfer is linked by an explicit mapping, never a guess
 * (docs/DECISIONS.md D-004).
 */
async function resolvePlayer(ctx: Ctx, p: NPlayer, clubSlug: string): Promise<string> {
  const cached = ctx.players.get(p.providerKey)
  if (cached) return cached
  let id = await mapped(ctx.tx, ctx.source, 'player', p.providerKey)
  if (!id) {
    const slug = await freeSlug(ctx.tx, 'players', [slugify(p.name), `${slugify(p.name)}-${clubSlug}`])
    ;[{ id }] = await ctx.tx.query<{ id: string }>(
      `INSERT INTO players (slug, name, normalized_name) VALUES ($1, $2, $3) RETURNING id`,
      [slug, p.name, normalizeName(p.name)],
    )
    await addMapping(ctx.tx, ctx.source, 'player', p.providerKey, id)
  }
  await ctx.tx.query(
    `INSERT INTO player_aliases (player_id, alias, normalized, source_code) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [id, p.name, normalizeName(p.name), ctx.source],
  )
  ctx.players.set(p.providerKey, id)
  return id
}

// ── Matches ─────────────────────────────────────────────────────────────────

const TRACKED = ['status', 'home_score', 'away_score', 'home_score_ht', 'away_score_ht', 'kickoff_on', 'kickoff_at', 'went_to_extra_time', 'home_penalties', 'away_penalties'] as const

async function writeMatch(ctx: Ctx, m: NMatch, now: Date) {
  const { tx } = ctx
  const homeId = await resolveClub(ctx, m.home)
  const awayId = await resolveClub(ctx, m.away)
  const [{ slug: homeSlug }] = await tx.query<{ slug: string }>(`SELECT slug FROM clubs WHERE id = $1`, [homeId])
  const [{ slug: awaySlug }] = await tx.query<{ slug: string }>(`SELECT slug FROM clubs WHERE id = $1`, [awayId])

  // Players first, so events can reference them.
  const playerIds = new Map<string, string>()
  const side = { home: { clubId: homeId, slug: homeSlug }, away: { clubId: awayId, slug: awaySlug } }
  if (m.lineups) {
    for (const s of ['home', 'away'] as const) {
      for (const p of [...m.lineups[s].starters, ...m.lineups[s].bench]) {
        playerIds.set(p.providerKey, await resolvePlayer(ctx, p, side[s].slug))
      }
    }
  }

  const row = {
    competition_season_id: ctx.csId,
    round: m.round,
    kickoff_on: m.kickoffOn,
    kickoff_at: m.kickoffAt,
    home_club_id: homeId,
    away_club_id: awayId,
    status: m.status,
    home_score: m.score?.home ?? null,
    away_score: m.score?.away ?? null,
    home_score_ht: m.halfTime?.home ?? null,
    away_score_ht: m.halfTime?.away ?? null,
    went_to_extra_time: m.extraTime,
    home_penalties: m.penalties?.home ?? null,
    away_penalties: m.penalties?.away ?? null,
    venue: m.venue,
    attendance: m.attendance,
    referee: m.referee,
    has_lineups: Boolean(m.lineups),
    source_code: ctx.source,
  }

  // Events in a stable, comparable form.
  const pid = (p: NPlayer | null) => (p ? playerIds.get(p.providerKey) ?? null : null)
  const events = m.events.map((e, seq) => ({
    seq,
    club_id: side[e.side].clubId,
    type: e.type,
    minute: e.minute,
    added_minute: e.added,
    player_id: pid(e.player),
    player_name: e.playerName,
    related_player_id: e.type === 'substitution' ? pid(e.off) : null,
  }))
  const eventsKey = JSON.stringify(events)

  let id = await mapped(tx, ctx.source, 'match', m.providerKey)
  let kind: 'inserted' | 'updated' | 'unchanged'
  let corrections = 0

  if (!id) {
    const slug = await freeSlug(tx, 'matches', [`${homeSlug}-vs-${awaySlug}-${m.kickoffOn}`])
    const cols = Object.keys(row)
    ;[{ id }] = await tx.query<{ id: string }>(
      `INSERT INTO matches (slug, ${cols.join(', ')}, retrieved_at) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}, $${cols.length + 2}) RETURNING id`,
      [slug, ...Object.values(row), now.toISOString()],
    )
    await addMapping(tx, ctx.source, 'match', m.providerKey, id)
    kind = 'inserted'
  } else {
    const [old] = await tx.query<Record<string, unknown>>(`SELECT status, home_score, away_score, home_score_ht, away_score_ht, kickoff_on::text AS kickoff_on,
         to_char(kickoff_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS kickoff_at,
         went_to_extra_time, home_penalties, away_penalties FROM matches WHERE id = $1`, [id])
    const oldEvents = await tx.query(`SELECT seq, club_id, type, minute, added_minute, player_id, player_name, related_player_id FROM match_events WHERE match_id = $1 ORDER BY seq`, [id])
    const changed = TRACKED.filter(f => String(old[f] ?? '') !== String(row[f] ?? ''))
    const eventsChanged = JSON.stringify(oldEvents) !== eventsKey
    for (const f of changed) {
      await tx.query(
        `INSERT INTO data_corrections (job_id, entity_type, entity_id, field, old_value, new_value) VALUES ($1, 'match', $2, $3, $4, $5)`,
        [ctx.jobId, id, f, JSON.stringify(old[f] ?? null), JSON.stringify(row[f] ?? null)],
      )
    }
    if (eventsChanged && oldEvents.length) {
      await tx.query(
        `INSERT INTO data_corrections (job_id, entity_type, entity_id, field, old_value, new_value) VALUES ($1, 'match', $2, 'events', $3, $4)`,
        [ctx.jobId, id, JSON.stringify(oldEvents.length), JSON.stringify(events.length)],
      )
    }
    corrections = changed.length + (eventsChanged && oldEvents.length ? 1 : 0)
    if (!changed.length && !eventsChanged) {
      await tx.query(`UPDATE matches SET retrieved_at = $2 WHERE id = $1`, [id, now.toISOString()])
      return { kind: 'unchanged' as const, id, corrections: 0, clubIds: [homeId, awayId], playerIds: [...playerIds.values()] }
    }
    const cols = Object.keys(row)
    await tx.query(
      `UPDATE matches SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, retrieved_at = $${cols.length + 2}, data_version = data_version + 1 WHERE id = $1`,
      [id, ...Object.values(row), now.toISOString()],
    )
    kind = 'updated'
  }

  // Replace lineups, events and derived lines for this match.
  await tx.query(`DELETE FROM match_lineups WHERE match_id = $1`, [id])
  await tx.query(`DELETE FROM match_events WHERE match_id = $1`, [id])
  await tx.query(`DELETE FROM player_match_statistics WHERE match_id = $1`, [id])
  if (m.lineups) {
    for (const s of ['home', 'away'] as const) {
      const l = m.lineups[s]
      for (const [role, list] of [['starter', l.starters], ['bench', l.bench]] as const) {
        for (const p of list) {
          await tx.query(
            `INSERT INTO match_lineups (match_id, player_id, club_id, role, is_captain) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [id, playerIds.get(p.providerKey), side[s].clubId, role, l.captainKey === p.providerKey],
          )
          await tx.query(
            `INSERT INTO player_club_memberships (player_id, club_id, competition_season_id, first_match_on, last_match_on) VALUES ($1, $2, $3, $4, $4)
             ON CONFLICT (player_id, club_id, competition_season_id) DO UPDATE SET
               first_match_on = LEAST(player_club_memberships.first_match_on, EXCLUDED.first_match_on),
               last_match_on = GREATEST(player_club_memberships.last_match_on, EXCLUDED.last_match_on)`,
            [playerIds.get(p.providerKey), side[s].clubId, ctx.csId, m.kickoffOn],
          )
        }
      }
    }
  }
  for (const e of events) {
    await tx.query(
      `INSERT INTO match_events (match_id, seq, club_id, type, minute, added_minute, player_id, player_name, related_player_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, e.seq, e.club_id, e.type, e.minute, e.added_minute, e.player_id, e.player_name, e.related_player_id],
    )
  }
  const { lines } = playerMatchLines(m)
  for (const l of lines) {
    await tx.query(
      `INSERT INTO player_match_statistics (match_id, player_id, club_id, started, minute_on, minute_off, minutes, goals, penalty_goals, own_goals, yellow_cards, red_cards)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, playerIds.get(l.playerKey), side[l.side].clubId, l.started, l.minuteOn, l.minuteOff, l.minutes, l.goals, l.penaltyGoals, l.ownGoals, l.yellowCards, l.redCards],
    )
  }
  return { kind, id, corrections, clubIds: [homeId, awayId], playerIds: [...playerIds.values()] }
}

// ── Derived tables ───────────────────────────────────────────────────────────

async function rebuildSeasonStats(tx: Db, csId: string, now: Date) {
  await tx.query(`DELETE FROM player_season_statistics WHERE competition_season_id = $1`, [csId])
  await tx.query(
    `INSERT INTO player_season_statistics (player_id, club_id, competition_season_id, appearances, starts, sub_appearances, unused_sub,
       minutes, goals, penalty_goals, own_goals, yellow_cards, red_cards, computed_at)
     SELECT l.player_id, l.club_id, $1,
       count(s.match_id), count(*) FILTER (WHERE s.started), count(*) FILTER (WHERE s.match_id IS NOT NULL AND NOT s.started),
       count(*) FILTER (WHERE l.role = 'bench' AND s.match_id IS NULL AND m.status = 'finished'),
       coalesce(sum(s.minutes), 0), coalesce(sum(s.goals), 0), coalesce(sum(s.penalty_goals), 0), coalesce(sum(s.own_goals), 0),
       coalesce(sum(s.yellow_cards), 0), coalesce(sum(s.red_cards), 0), $2
     FROM match_lineups l
     JOIN matches m ON m.id = l.match_id AND m.competition_season_id = $1
     LEFT JOIN player_match_statistics s ON s.match_id = l.match_id AND s.player_id = l.player_id
     GROUP BY l.player_id, l.club_id`,
    [csId, now.toISOString()],
  )
}

/** League table from finished results, ordered by points, goal difference, goals scored, then name. */
async function rebuildStandings(tx: Db, csId: string, source: string, now: Date) {
  await tx.query(`DELETE FROM standings WHERE competition_season_id = $1 AND method = 'computed'`, [csId])
  await tx.query(
    `WITH results AS (
       SELECT home_club_id AS club_id, home_score AS gf, away_score AS ga FROM matches WHERE competition_season_id = $1 AND status = 'finished'
       UNION ALL
       SELECT away_club_id, away_score, home_score FROM matches WHERE competition_season_id = $1 AND status = 'finished'
     ), agg AS (
       SELECT club_id, count(*) AS played, count(*) FILTER (WHERE gf > ga) AS won, count(*) FILTER (WHERE gf = ga) AS drawn,
              count(*) FILTER (WHERE gf < ga) AS lost, sum(gf) AS goals_for, sum(ga) AS goals_against,
              3 * count(*) FILTER (WHERE gf > ga) + count(*) FILTER (WHERE gf = ga) AS points
       FROM results GROUP BY club_id
     )
     INSERT INTO standings (competition_season_id, club_id, position, played, won, drawn, lost, goals_for, goals_against, points, method, source_code, as_of)
     SELECT $1, a.club_id, row_number() OVER (ORDER BY a.points DESC, a.goals_for - a.goals_against DESC, a.goals_for DESC, c.name),
            a.played, a.won, a.drawn, a.lost, a.goals_for, a.goals_against, a.points, 'computed', $2, $3
     FROM agg a JOIN clubs c ON c.id = a.club_id
     ON CONFLICT (competition_season_id, club_id) DO NOTHING`,
    [csId, source, now.toISOString()],
  )
}
