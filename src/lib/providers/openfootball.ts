import { z } from 'zod'
import { displayName, normalizeClubName, normalizeName } from '@/lib/names'
import type { NCompetitionSeason, NEvent, NLineup, NMatch, NPlayer, Provider } from './types'

/**
 * openfootball (CC0 1.0). Static JSON on GitHub: no key, no quota, but fetched
 * once per ingest run, never per visitor.
 *
 * Player keys are `normalised name@club key` (docs/DECISIONS.md D-004):
 * the source has no player IDs, so a name is only trusted within a club.
 */

const BASE = 'https://raw.githubusercontent.com/openfootball/football.json/master'

/** Our competition slug → openfootball file stem, plus the facts the file doesn't carry. */
export const OPENFOOTBALL_COMPETITIONS = {
  'premier-league': { file: 'en.1', name: 'Premier League', shortName: 'PL', country: 'England', kind: 'league' as const },
}

const Person = z.object({ name: z.string().min(1), captain: z.boolean().optional() })
const Side = z.object({
  starter: z.array(Person),
  bench: z.array(Person).optional(),
  subs: z.array(z.object({ on: z.string(), off: z.string(), minute: z.string() })).optional(),
})
const Goal = z.object({ name: z.string(), minute: z.string(), penalty: z.boolean().optional(), owngoal: z.boolean().optional() })
const Booking = z.object({ type: z.enum(['Y', 'R', 'Y/R']), name: z.string(), minute: z.string() })
const Score = z.object({
  ft: z.tuple([z.number(), z.number()]).optional(),
  ht: z.tuple([z.number(), z.number()]).optional(),
  et: z.tuple([z.number(), z.number()]).optional(),
  p: z.tuple([z.number(), z.number()]).optional(),
})
const Match = z.object({
  round: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(),
  team1: z.string(),
  team2: z.string(),
  // Usually {ht, ft}; some files use a bare [home, away] pair for the full-time score.
  score: z.union([Score, z.tuple([z.number(), z.number()])]).optional(),
  goals1: z.array(Goal).optional(),
  goals2: z.array(Goal).optional(),
  ground: z.string().optional(),
  attendance: z.number().optional(),
  lineup: z.tuple([Side, Side]).optional(),
  bookings: z.tuple([z.array(Booking), z.array(Booking)]).optional(),
  referees: z.array(z.object({ name: z.string() })).optional(),
})
export const SeasonFile = z.object({ name: z.string(), matches: z.array(Match) })
type RawMatch = z.infer<typeof Match>

export function parseMinute(text: string): { minute: number; added: number | null } {
  const m = /^(\d+)(?:\+(\d+))?$/.exec(text.trim())
  if (!m) throw new Error(`Unrecognised minute "${text}"`)
  return { minute: Number(m[1]), added: m[2] ? Number(m[2]) : null }
}

/** "19:00 UTC+1" on 2025-08-15 → "2025-08-15T18:00:00.000Z". */
export function parseKickoff(date: string, time: string | undefined): string | null {
  if (!time) return null
  const m = /^(\d{2}):(\d{2})(?:\s*UTC([+-]\d{1,2})(?::?(\d{2}))?)?$/.exec(time.trim())
  if (!m || m[3] === undefined) return null // no offset: the time zone is unknown, so don't guess
  const sign = m[3].startsWith('-') ? -1 : 1
  const offsetMin = sign * (Math.abs(Number(m[3])) * 60 + Number(m[4] ?? 0))
  const utc = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +m[1], +m[2]) - offsetMin * 60_000
  return new Date(utc).toISOString()
}

export function clubKey(name: string) {
  return normalizeClubName(name)
}

function toMatch(raw: RawMatch, competitionKey: string, warn: (ref: string, reason: string) => void): NMatch {
  const homeKey = clubKey(raw.team1)
  const awayKey = clubKey(raw.team2)
  const ref = `${raw.date} ${raw.team1} v ${raw.team2}`

  // Resolve a published name to a player in this match's lineup for the given side.
  const rosters = { home: new Map<string, NPlayer>(), away: new Map<string, NPlayer>() }
  const lineup = (side: z.infer<typeof Side>, club: string, roster: Map<string, NPlayer>): NLineup => {
    const ref = (p: { name: string }): NPlayer => {
      const player = { providerKey: `${normalizeName(p.name)}@${club}`, name: displayName(p.name) }
      roster.set(normalizeName(p.name), player)
      return player
    }
    const starters = side.starter.map(ref)
    const bench = (side.bench ?? []).map(ref)
    const captain = side.starter.find(p => p.captain)
    return { starters, bench, captainKey: captain ? `${normalizeName(captain.name)}@${club}` : null }
  }
  const lineups = raw.lineup
    ? { home: lineup(raw.lineup[0], homeKey, rosters.home), away: lineup(raw.lineup[1], awayKey, rosters.away) }
    : null
  const find = (side: 'home' | 'away', name: string): NPlayer | null => {
    if (!lineups) return null
    const p = rosters[side].get(normalizeName(name))
    if (!p) warn(ref, `"${name}" is not in the ${side} lineup`)
    return p ?? null
  }

  const events: NEvent[] = []
  const goalSides: ['home' | 'away', z.infer<typeof Goal>[]][] = [['home', raw.goals1 ?? []], ['away', raw.goals2 ?? []]]
  for (const [side, goals] of goalSides) {
    for (const g of goals) {
      const at = parseMinute(g.minute)
      if (g.owngoal) {
        // Listed under the team it counts for; the scorer plays for the other side.
        events.push({ type: 'own_goal', side, player: find(side === 'home' ? 'away' : 'home', g.name), playerName: displayName(g.name), ...at })
      } else {
        events.push({ type: g.penalty ? 'penalty_goal' : 'goal', side, player: find(side, g.name), playerName: displayName(g.name), ...at })
      }
    }
  }
  const CARD = { Y: 'yellow_card', 'Y/R': 'second_yellow', R: 'red_card' } as const
  raw.bookings?.forEach((list, i) => {
    const side = i === 0 ? 'home' : 'away'
    for (const b of list) events.push({ type: CARD[b.type], side, player: find(side, b.name), playerName: displayName(b.name), ...parseMinute(b.minute) })
  })
  raw.lineup?.forEach((s, i) => {
    const side = i === 0 ? 'home' : 'away'
    for (const sub of s.subs ?? []) {
      events.push({
        type: 'substitution', side, player: find(side, sub.on), playerName: displayName(sub.on),
        off: find(side, sub.off), offName: displayName(sub.off), ...parseMinute(sub.minute),
      })
    }
  })
  events.sort((a, b) => a.minute - b.minute || (a.added ?? 0) - (b.added ?? 0))

  if (Array.isArray(raw.score)) warn(ref, `compact score ${JSON.stringify(raw.score)} read as the full-time score`)
  const score = Array.isArray(raw.score) ? { ft: raw.score } : raw.score
  const ft = score?.ft
  const kickoffAt = parseKickoff(raw.date, raw.time)
  if (raw.time && !kickoffAt) warn(ref, `kick-off time "${raw.time}" has no UTC offset; stored as date only`)
  return {
    providerKey: `${competitionKey}:${raw.date}:${homeKey}:${awayKey}`,
    round: raw.round ?? null,
    kickoffOn: raw.date,
    kickoffAt,
    home: { providerKey: homeKey, name: raw.team1 },
    away: { providerKey: awayKey, name: raw.team2 },
    // The source has no status field: a score means finished; otherwise it is
    // scheduled. A past match without a score is "result not available yet",
    // which the UI derives from the date and the source's freshness.
    status: ft ? 'finished' : 'scheduled',
    score: ft ? { home: ft[0], away: ft[1] } : null,
    halfTime: score?.ht ? { home: score.ht[0], away: score.ht[1] } : null,
    extraTime: ft ? Boolean(score?.et) : null,
    penalties: score?.p ? { home: score.p[0], away: score.p[1] } : null,
    venue: raw.ground ?? null,
    attendance: raw.attendance ?? null,
    referee: raw.referees?.[0]?.name ?? null,
    lineups,
    events,
  }
}

/** Parses a season file. Exported separately so tests run without the network. */
export function parseSeason(json: unknown, competitionKey: keyof typeof OPENFOOTBALL_COMPETITIONS, seasonKey: string, sourceUpdatedAt: string | null): NCompetitionSeason {
  const file = SeasonFile.parse(json)
  const warnings: NCompetitionSeason['warnings'] = []
  const comp = OPENFOOTBALL_COMPETITIONS[competitionKey]
  const [y1, y2] = seasonKey.split('-')
  const dates = file.matches.map(m => m.date).sort()
  return {
    source: 'openfootball',
    competition: { key: competitionKey, name: comp.name, shortName: comp.shortName, country: comp.country, kind: comp.kind },
    season: { key: seasonKey, name: `${y1}/${y2}`, startsOn: dates[0] ?? null, endsOn: dates.at(-1) ?? null },
    sourceUpdatedAt,
    matches: file.matches.map(m => toMatch(m, competitionKey, (ref, reason) => warnings.push({ ref, reason }))),
    warnings,
  }
}

export const openfootball: Provider = {
  code: 'openfootball',
  capabilities: { fixtures: true, results: true, lineups: true, goals: true, cards: true, standings: false, playerSeasonStats: false },
  enabled: () => true,
  async fetchCompetitionSeason(competitionKey, seasonKey) {
    if (!(competitionKey in OPENFOOTBALL_COMPETITIONS)) throw new Error(`openfootball: no mapping for ${competitionKey}`)
    const key = competitionKey as keyof typeof OPENFOOTBALL_COMPETITIONS
    const stem = OPENFOOTBALL_COMPETITIONS[key].file
    // Prefer the "-full" file (lineups, cards); fall back to scores only.
    for (const name of [`${stem}-full.json`, `${stem}.json`]) {
      const res = await fetch(`${BASE}/${seasonKey}/${name}`)
      if (res.status === 404) continue
      if (!res.ok) throw new Error(`openfootball: ${name} returned HTTP ${res.status}`)
      const updated = await lastCommitDate(`${seasonKey}/${name}`)
      return parseSeason(await res.json(), key, seasonKey, updated)
    }
    throw new Error(`openfootball: no data for ${competitionKey} ${seasonKey}`)
  },
}

/** When the file last changed upstream, for freshness labels. Best effort. */
async function lastCommitDate(filePath: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/openfootball/football.json/commits?path=${encodeURIComponent(filePath)}&per_page=1`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const [c] = (await res.json()) as { commit: { committer: { date: string } } }[]
    return c?.commit.committer.date ?? null
  } catch {
    return null
  }
}
