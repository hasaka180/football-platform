import { z } from 'zod'
import { normalizeClubName } from '@/lib/names'
import { RequestBudget } from './budget'
import type { MatchStatus, NCompetitionSeason, NMatch, Provider } from './types'

/**
 * football-data.org v4, free tier: fixtures, results and tables for 12
 * competitions including PL and CL, 10 calls/minute, delayed scores.
 * Disabled until FOOTBALL_DATA_API_KEY is set. Attribution is required
 * (docs/LICENSING.md); crest URLs in responses are ignored.
 *
 * Mapping verified against the published v4 docs, not yet against live
 * responses: re-run the contract tests with a recorded response once a key
 * exists (docs/FREE_DATA_PROVIDERS.md).
 */

const API = 'https://api.football-data.org/v4'

export const FOOTBALL_DATA_COMPETITIONS = {
  'premier-league': { code: 'PL', name: 'Premier League', shortName: 'PL', country: 'England', kind: 'league' as const },
  'champions-league': { code: 'CL', name: 'UEFA Champions League', shortName: 'UCL', country: null, kind: 'cup' as const },
}

const STATUS: Record<string, MatchStatus> = {
  SCHEDULED: 'scheduled', TIMED: 'scheduled', IN_PLAY: 'live', PAUSED: 'halftime', EXTRA_TIME: 'extra_time',
  PENALTY_SHOOTOUT: 'penalties', FINISHED: 'finished', AWARDED: 'finished', SUSPENDED: 'suspended',
  POSTPONED: 'postponed', CANCELLED: 'cancelled',
}

const Pair = z.object({ home: z.number().nullable(), away: z.number().nullable() })
const Team = z.object({ id: z.number(), name: z.string().nullable(), shortName: z.string().nullable().optional() })
const FdMatch = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  matchday: z.number().nullable().optional(),
  stage: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  attendance: z.number().nullable().optional(),
  homeTeam: Team,
  awayTeam: Team,
  score: z.object({
    duration: z.enum(['REGULAR', 'EXTRA_TIME', 'PENALTY_SHOOTOUT']).optional(),
    fullTime: Pair,
    halfTime: Pair.optional(),
    penalties: Pair.optional(),
  }),
  referees: z.array(z.object({ name: z.string(), type: z.string().optional() })).optional(),
  lastUpdated: z.string().optional(),
})
export const FdMatches = z.object({
  competition: z.object({ code: z.string(), name: z.string() }),
  filters: z.object({ season: z.union([z.string(), z.number()]).optional() }).optional(),
  matches: z.array(FdMatch),
})

const pair = (p?: z.infer<typeof Pair>) => (p && p.home !== null && p.away !== null ? { home: p.home, away: p.away } : null)

/** Maps a v4 competition-matches response. Exported for contract tests. */
export function mapMatches(json: unknown, competitionKey: keyof typeof FOOTBALL_DATA_COMPETITIONS, seasonKey: string): NCompetitionSeason {
  const data = FdMatches.parse(json)
  const comp = FOOTBALL_DATA_COMPETITIONS[competitionKey]
  const warnings: NCompetitionSeason['warnings'] = []
  const matches: NMatch[] = data.matches.map(m => {
    const status = STATUS[m.status]
    if (!status) warnings.push({ ref: `fd:${m.id}`, reason: `unknown status ${m.status}; treated as scheduled` })
    const name = (t: z.infer<typeof Team>) => t.name ?? t.shortName ?? `Team ${t.id}`
    const score = pair(m.score.fullTime)
    return {
      providerKey: `fd:${m.id}`,
      round: m.matchday ? `Matchday ${m.matchday}` : m.stage ?? null,
      kickoffOn: m.utcDate.slice(0, 10),
      kickoffAt: new Date(m.utcDate).toISOString(),
      // Club keys use the normalised name so the same club from openfootball
      // resolves to one record (the ingest also checks aliases).
      home: { providerKey: normalizeClubName(name(m.homeTeam)), name: name(m.homeTeam) },
      away: { providerKey: normalizeClubName(name(m.awayTeam)), name: name(m.awayTeam) },
      status: status ?? 'scheduled',
      // Scores before full time are provisional and delayed on the free tier,
      // so only a finished match's score is stored.
      score: status === 'finished' ? score : null,
      halfTime: status === 'finished' ? pair(m.score.halfTime) : null,
      extraTime: status === 'finished' ? m.score.duration !== 'REGULAR' : null,
      penalties: pair(m.score.penalties),
      venue: m.venue ?? null,
      attendance: m.attendance ?? null,
      referee: m.referees?.find(r => r.type === 'REFEREE')?.name ?? null,
      lineups: null, // not on the free tier
      events: [],
    }
  })
  const dates = matches.map(m => m.kickoffOn).sort()
  const [y1, y2] = seasonKey.split('-')
  return {
    source: 'football-data',
    competition: { key: competitionKey, name: comp.name, shortName: comp.shortName, country: comp.country, kind: comp.kind },
    season: { key: seasonKey, name: `${y1}/${y2}`, startsOn: dates[0] ?? null, endsOn: dates.at(-1) ?? null },
    sourceUpdatedAt: data.matches.map(m => m.lastUpdated).filter(Boolean).sort().at(-1) ?? null,
    matches,
    warnings,
  }
}

export function footballData(opts: { onRequest?: () => Promise<void> | void; fetchImpl?: typeof fetch } = {}): Provider {
  const budget = new RequestBudget({ perMinute: 9, onRequest: opts.onRequest }) // one under the limit
  const doFetch = opts.fetchImpl ?? fetch
  return {
    code: 'football-data',
    capabilities: { fixtures: true, results: true, lineups: false, goals: false, cards: false, standings: true, playerSeasonStats: false },
    enabled: () => Boolean(process.env.FOOTBALL_DATA_API_KEY),
    async fetchCompetitionSeason(competitionKey, seasonKey) {
      const key = process.env.FOOTBALL_DATA_API_KEY
      if (!key) throw new Error('football-data: FOOTBALL_DATA_API_KEY is not set')
      if (!(competitionKey in FOOTBALL_DATA_COMPETITIONS)) throw new Error(`football-data: no mapping for ${competitionKey}`)
      const k = competitionKey as keyof typeof FOOTBALL_DATA_COMPETITIONS
      const url = `${API}/competitions/${FOOTBALL_DATA_COMPETITIONS[k].code}/matches?season=${seasonKey.slice(0, 4)}`
      const res = await budget.run(() => doFetch(url, { headers: { 'X-Auth-Token': key } }))
      if (!res.ok) throw new Error(`football-data: HTTP ${res.status} for ${competitionKey} ${seasonKey}`)
      return mapMatches(await res.json(), k, seasonKey)
    },
  }
}
