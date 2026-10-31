import { describe, expect, it } from 'vitest'
import { canonicalPair, combineSeason, compareLines, pickSeasons, splitPair, type SeasonLine } from '@/lib/compare'

const line = (o: Partial<SeasonLine>): SeasonLine => ({
  season: '2025/26', seasonSlug: '2025-26', competition: 'Premier League', club: 'Northbridge', clubSlug: 'northbridge',
  appearances: 30, starts: 28, subAppearances: 2, minutes: 2520, goals: 14, penaltyGoals: 4, ownGoals: 0,
  yellowCards: 3, redCards: 0, clubGoals: 70, clubMatches: 38, ...o,
})

const value = (rows: ReturnType<typeof compareLines>, key: string) => rows.find(r => r.metric.key === key)!

describe('comparison metrics', () => {
  const rows = compareLines(line({}), line({ minutes: 900, goals: 6, penaltyGoals: 0, clubGoals: 40 }))

  it('computes per-90 and non-penalty rates from minutes', () => {
    expect(value(rows, 'goalsPer90').a).toBeCloseTo(0.5)
    expect(value(rows, 'npgPer90').a).toBeCloseTo((10 * 90) / 2520)
    expect(value(rows, 'goalsPer90').b).toBeCloseTo(0.6)
  })

  it('computes shares against club context', () => {
    expect(value(rows, 'goalShare').a).toBeCloseTo(0.2)
    expect(value(rows, 'minutesShare').a).toBeCloseTo(2520 / (38 * 90))
  })

  it('scales bars to the larger value, never claiming a winner beyond the numbers', () => {
    const g = value(rows, 'goals')
    expect([g.barA, g.barB]).toEqual([1, 6 / 14])
  })

  it('returns null, not zero, when a rate is undefined', () => {
    const r = compareLines(line({ goals: 0, penaltyGoals: 0, minutes: 0 }), line({}))
    expect(value(r, 'goalsPer90').a).toBeNull()
    expect(value(r, 'minutesPerGoal').a).toBeNull()
    expect(value(r, 'goalsPer90').barA).toBe(0)
  })

  it('drops club-share context when a season spans two clubs', () => {
    const both = combineSeason([line({}), line({ club: 'Eastport', minutes: 500, goals: 2, penaltyGoals: 0 })])!
    expect(both).toMatchObject({ club: 'Northbridge / Eastport', minutes: 3020, goals: 16, clubGoals: null })
  })
})

describe('season selection', () => {
  it('uses the latest common season', () => {
    const r = pickSeasons([line({}), line({ seasonSlug: '2026-27', season: '2026/27' })], [line({ goals: 9 })])
    expect(r.sameSeason).toBe(true)
    expect(r.a?.seasonSlug).toBe('2025-26')
  })
  it('flags a mismatch when there is no common season', () => {
    const r = pickSeasons([line({ seasonSlug: '2024-25' })], [line({})])
    expect(r).toMatchObject({ sameSeason: false, a: { seasonSlug: '2024-25' }, b: { seasonSlug: '2025-26' } })
  })
})

describe('pair URLs', () => {
  it('orders slugs alphabetically for the canonical URL', () => {
    expect(canonicalPair('mohamed-salah', 'bukayo-saka')).toBe('bukayo-saka-vs-mohamed-salah')
  })
  it('handles a slug that itself contains -vs-', () => {
    expect(splitPair('a-vs-b')).toEqual([['a', 'b']])
    expect(splitPair('a-vs-b-vs-c')).toEqual([['a', 'b-vs-c'], ['a-vs-b', 'c']])
  })
})
