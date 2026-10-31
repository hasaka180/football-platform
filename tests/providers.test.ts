import { describe, expect, it } from 'vitest'
import { CircuitOpen, QuotaExhausted, RequestBudget } from '@/lib/providers/budget'
import { mapMatches } from '@/lib/providers/football-data'

// Synthetic response shaped from the published v4 docs (DEV FIXTURE: fictional
// IDs). Replace with a recorded response once a key exists.
const fdResponse = {
  competition: { code: 'PL', name: 'Premier League' },
  filters: { season: '2026' },
  matches: [
    { id: 1, utcDate: '2026-08-22T14:00:00Z', status: 'FINISHED', matchday: 1, homeTeam: { id: 57, name: 'Arsenal FC' }, awayTeam: { id: 61, name: 'Chelsea FC' },
      score: { duration: 'REGULAR', fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 1 } }, referees: [{ name: 'A Ref', type: 'REFEREE' }], lastUpdated: '2026-08-23T08:00:00Z' },
    { id: 2, utcDate: '2026-08-29T16:30:00Z', status: 'POSTPONED', matchday: 2, homeTeam: { id: 61, name: 'Chelsea FC' }, awayTeam: { id: 57, name: 'Arsenal FC' },
      score: { duration: 'REGULAR', fullTime: { home: null, away: null } } },
    { id: 3, utcDate: '2026-08-29T19:00:00Z', status: 'IN_PLAY', matchday: 2, homeTeam: { id: 1, name: 'AFC Bournemouth' }, awayTeam: { id: 2, name: 'Wolverhampton Wanderers FC' },
      score: { duration: 'REGULAR', fullTime: { home: 1, away: 0 } } },
    { id: 4, utcDate: '2027-05-29T19:00:00Z', status: 'FINISHED', stage: 'FINAL', homeTeam: { id: 3, name: 'Club A' }, awayTeam: { id: 4, name: 'Club B' },
      score: { duration: 'PENALTY_SHOOTOUT', fullTime: { home: 1, away: 1 }, penalties: { home: 5, away: 4 } } },
    { id: 5, utcDate: '2026-09-01T19:00:00Z', status: 'SOMETHING_NEW', homeTeam: { id: 5, name: 'Club C' }, awayTeam: { id: 6, name: 'Club D' },
      score: { fullTime: { home: null, away: null } } },
  ],
}

describe('football-data.org mapping (contract)', () => {
  const s = mapMatches(fdResponse, 'premier-league', '2026-27')
  const [fin, postponed, live, final, unknown] = s.matches

  it('maps statuses, including postponed and live', () => {
    expect([fin.status, postponed.status, live.status, final.status, unknown.status]).toEqual(['finished', 'postponed', 'live', 'finished', 'scheduled'])
    expect(s.warnings[0].reason).toMatch(/unknown status SOMETHING_NEW/)
  })

  it('stores scores only for finished matches, never a provisional live score', () => {
    expect(fin.score).toEqual({ home: 2, away: 1 })
    expect(live.score).toBeNull()
    expect(postponed.score).toBeNull()
  })

  it('keeps kick-off in UTC and records extra time and shoot-outs', () => {
    expect(fin.kickoffAt).toBe('2026-08-22T14:00:00.000Z')
    expect(final.extraTime).toBe(true)
    expect(final.penalties).toEqual({ home: 5, away: 4 })
  })

  it('keys clubs by normalised name so they join openfootball clubs', () => {
    expect(fin.home.providerKey).toBe('arsenal')
    expect(live.home.providerKey).toBe('bournemouth')
    expect(live.away.providerKey).toBe('wolverhampton wanderers')
  })

  it('records the newest lastUpdated as the source update time', () => {
    expect(s.sourceUpdatedAt).toBe('2026-08-23T08:00:00Z')
  })
})

describe('request budget', () => {
  const clock = () => {
    let t = 0
    return { now: () => t, sleep: async (ms: number) => { t += ms } }
  }
  const ok = () => new Response('{}', { status: 200 })

  it('never exceeds the per-minute limit', async () => {
    const c = clock()
    const sentAt: number[] = []
    const b = new RequestBudget({ perMinute: 3, ...c, onRequest: () => { sentAt.push(c.now()) } })
    for (let i = 0; i < 7; i++) await b.run(async () => ok())
    for (const t of sentAt) expect(sentAt.filter(x => x > t - 60_000 && x <= t).length).toBeLessThanOrEqual(3)
    expect(sentAt).toHaveLength(7)
  })

  it('waits for the provider reset on 429, then succeeds', async () => {
    const c = clock()
    let calls = 0
    const b = new RequestBudget({ perMinute: 10, ...c })
    const res = await b.run(async () => (++calls === 1 ? new Response('', { status: 429, headers: { 'X-RequestCounter-Reset': '30' } }) : ok()))
    expect(res.status).toBe(200)
    expect(c.now()).toBeGreaterThanOrEqual(30_000)
  })

  it('reports quota exhaustion after retries', async () => {
    const b = new RequestBudget({ perMinute: 10, maxRetries: 2, failureThreshold: 99, ...clock() })
    await expect(b.run(async () => new Response('', { status: 429 }))).rejects.toBeInstanceOf(QuotaExhausted)
  })

  it('opens the circuit after repeated failures and refuses further calls', async () => {
    const b = new RequestBudget({ perMinute: 10, maxRetries: 10, failureThreshold: 3, ...clock() })
    await expect(b.run(async () => new Response('', { status: 503 }))).rejects.toBeInstanceOf(CircuitOpen)
    let called = false
    await expect(b.run(async () => { called = true; return ok() })).rejects.toBeInstanceOf(CircuitOpen)
    expect(called).toBe(false)
  })

  it('does not retry a client error', async () => {
    let calls = 0
    const res = await new RequestBudget({ perMinute: 10, ...clock() }).run(async () => { calls++; return new Response('', { status: 403 }) })
    expect([res.status, calls]).toEqual([403, 1])
  })
})
