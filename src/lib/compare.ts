/**
 * The comparison engine. Pure functions over season rows, so every number on
 * a comparison page is reproducible and tested. There is deliberately no
 * overall "better player" score: metrics are shown side by side with the
 * sample behind them.
 */

export type SeasonLine = {
  season: string
  seasonSlug: string
  competition: string
  club: string
  clubSlug: string
  appearances: number
  starts: number
  subAppearances: number
  minutes: number
  goals: number
  penaltyGoals: number
  ownGoals: number
  yellowCards: number
  redCards: number
  clubGoals: number | null
  clubMatches: number
}

/** Below this many minutes, per-90 numbers swing a lot on a single goal. */
export const SMALL_SAMPLE_MINUTES = 900

export type Metric = {
  key: string
  label: string
  group: 'Playing time' | 'Scoring' | 'Discipline'
  definition: string
  value: (r: SeasonLine) => number | null
  format: (n: number) => string
  /** A rate that depends on minutes; flagged when the sample is small. */
  rate?: boolean
  /** For display only: lower values mean more of the thing (minutes per goal). */
  lowerMeansMore?: boolean
}

const int = (n: number) => n.toLocaleString('en-GB')
const dp2 = (n: number) => n.toFixed(2)
const pct = (n: number) => `${Math.round(n * 100)}%`
const per90 = (count: number, minutes: number) => (minutes > 0 ? (count * 90) / minutes : null)

export const METRICS: Metric[] = [
  { key: 'appearances', label: 'Appearances', group: 'Playing time', definition: 'League matches played, as a starter or a substitute.', value: r => r.appearances, format: int },
  { key: 'starts', label: 'Starts', group: 'Playing time', definition: 'Matches in the starting XI.', value: r => r.starts, format: int },
  { key: 'minutes', label: 'Minutes', group: 'Playing time', definition: 'Derived from lineups and substitutions: 90 per full match, extra time where played, stoppage time not counted.', value: r => r.minutes, format: int },
  { key: 'minutesShare', label: 'Share of club minutes', group: 'Playing time', definition: 'Minutes as a share of the club’s available league minutes (matches played × 90).', value: r => (r.clubMatches > 0 ? r.minutes / (r.clubMatches * 90) : null), format: pct },
  { key: 'goals', label: 'Goals', group: 'Scoring', definition: 'League goals, including penalties. Own goals are not counted.', value: r => r.goals, format: int },
  { key: 'npg', label: 'Non-penalty goals', group: 'Scoring', definition: 'Goals excluding penalties.', value: r => r.goals - r.penaltyGoals, format: int },
  { key: 'penaltyGoals', label: 'Penalty goals', group: 'Scoring', definition: 'Goals scored from penalty kicks during a match. Shoot-outs are not counted.', value: r => r.penaltyGoals, format: int },
  { key: 'goalsPer90', label: 'Goals per 90', group: 'Scoring', definition: 'Goals × 90 ÷ minutes.', value: r => per90(r.goals, r.minutes), format: dp2, rate: true },
  { key: 'npgPer90', label: 'Non-penalty goals per 90', group: 'Scoring', definition: 'Non-penalty goals × 90 ÷ minutes.', value: r => per90(r.goals - r.penaltyGoals, r.minutes), format: dp2, rate: true },
  { key: 'minutesPerGoal', label: 'Minutes per goal', group: 'Scoring', definition: 'Minutes ÷ goals. Lower means scoring more often. Not shown without a goal.', value: r => (r.goals > 0 ? r.minutes / r.goals : null), format: n => int(Math.round(n)), rate: true, lowerMeansMore: true },
  { key: 'goalShare', label: 'Share of club goals', group: 'Scoring', definition: 'The player’s goals as a share of all league goals their club scored that season.', value: r => (r.clubGoals ? r.goals / r.clubGoals : null), format: pct },
  { key: 'yellowCards', label: 'Yellow cards', group: 'Discipline', definition: 'Yellow cards, not counting a second yellow that led to a sending-off.', value: r => r.yellowCards, format: int },
  { key: 'redCards', label: 'Red cards', group: 'Discipline', definition: 'Sendings-off, including second yellows.', value: r => r.redCards, format: int },
  { key: 'ownGoals', label: 'Own goals', group: 'Discipline', definition: 'Own goals scored.', value: r => r.ownGoals, format: int },
]

/** Metrics fans expect that our free sources don't publish. Shown, never faked. */
export const UNAVAILABLE_METRICS = ['Assists', 'Shots', 'Expected goals (xG)', 'Passes', 'Tackles and interceptions', 'Position']

export type ComparedRow = {
  metric: Metric
  a: number | null
  b: number | null
  /** 0–1 bar lengths relative to the larger of the two values. */
  barA: number
  barB: number
}

export function compareLines(a: SeasonLine, b: SeasonLine): ComparedRow[] {
  return METRICS.map(metric => {
    const va = metric.value(a)
    const vb = metric.value(b)
    const max = Math.max(va ?? 0, vb ?? 0)
    return { metric, a: va, b: vb, barA: max > 0 && va !== null ? va / max : 0, barB: max > 0 && vb !== null ? vb / max : 0 }
  })
}

/** Sum a player's lines for one season (a player can appear for more than one club). */
export function combineSeason(lines: SeasonLine[]): SeasonLine | null {
  if (!lines.length) return null
  const sum = (k: keyof SeasonLine) => lines.reduce((t, l) => t + (l[k] as number), 0)
  const [first] = lines
  return {
    ...first,
    club: lines.map(l => l.club).join(' / '),
    appearances: sum('appearances'), starts: sum('starts'), subAppearances: sum('subAppearances'), minutes: sum('minutes'),
    goals: sum('goals'), penaltyGoals: sum('penaltyGoals'), ownGoals: sum('ownGoals'), yellowCards: sum('yellowCards'), redCards: sum('redCards'),
    // Club context only makes sense for a single club.
    clubGoals: lines.length === 1 ? first.clubGoals : null,
    clubMatches: lines.length === 1 ? first.clubMatches : 0,
  }
}

/**
 * The season to compare: the most recent season both players have data for.
 * Falls back to each player's latest season (flagged as a mismatch).
 */
export function pickSeasons(a: SeasonLine[], b: SeasonLine[]): { a: SeasonLine | null; b: SeasonLine | null; sameSeason: boolean } {
  const seasonsA = new Set(a.map(l => l.seasonSlug))
  const common = [...new Set(b.map(l => l.seasonSlug))].filter(s => seasonsA.has(s)).sort().reverse()[0]
  const latest = (lines: SeasonLine[]) => [...new Set(lines.map(l => l.seasonSlug))].sort().reverse()[0]
  const sa = common ?? latest(a)
  const sb = common ?? latest(b)
  return {
    a: combineSeason(a.filter(l => l.seasonSlug === sa)),
    b: combineSeason(b.filter(l => l.seasonSlug === sb)),
    sameSeason: Boolean(common),
  }
}

/** Canonical pair URL: slugs in alphabetical order. */
export function canonicalPair(a: string, b: string): string {
  return [a, b].sort().join('-vs-')
}

/** Splits "a-vs-b". Returns every possible split when a slug itself contains "-vs-". */
export function splitPair(pair: string): [string, string][] {
  const parts = pair.split('-vs-')
  const out: [string, string][] = []
  for (let i = 1; i < parts.length; i++) out.push([parts.slice(0, i).join('-vs-'), parts.slice(i).join('-vs-')])
  return out
}
