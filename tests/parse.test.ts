import { describe, expect, it } from 'vitest'
import fixture from './fixtures/openfootball-mini.json'
import { displayName, normalizeClubName, normalizeName, slugify } from '@/lib/names'
import { parseKickoff, parseMinute, parseSeason } from '@/lib/providers/openfootball'

describe('names', () => {
  it('normalises case, accents and punctuation for matching', () => {
    expect(normalizeName('Luis PEÑA')).toBe('luis pena')
    expect(normalizeName("N'Golo  Kanté")).toBe('n golo kante')
    expect(slugify('Brighton & Hove Albion')).toBe('brighton-hove-albion')
  })
  it('matches clubs across FC/AFC naming differences', () => {
    expect(normalizeClubName('Liverpool FC')).toBe(normalizeClubName('Liverpool'))
    expect(normalizeClubName('AFC Bournemouth')).toBe('bournemouth')
    expect(normalizeClubName('Sunderland AFC')).toBe('sunderland')
  })
  it('title-cases all-caps surnames but leaves mixed case alone', () => {
    expect(displayName('MOHAMED SALAH')).toBe('Mohamed Salah')
    expect(displayName('Virgil VAN DIJK')).toBe('Virgil van Dijk')
    expect(displayName('Federico Chiesa')).toBe('Federico Chiesa')
    expect(displayName('Dwight McNeil')).toBe('Dwight McNeil')
    expect(displayName("Dara O'SHEA")).toBe("Dara O'Shea")
  })
})

describe('openfootball parsing', () => {
  it('parses minutes with added time', () => {
    expect(parseMinute('45+2')).toEqual({ minute: 45, added: 2 })
    expect(parseMinute('77')).toEqual({ minute: 77, added: null })
    expect(() => parseMinute('half time')).toThrow()
  })

  it('converts kick-off to UTC and refuses to guess a missing offset', () => {
    expect(parseKickoff('2025-08-16', '15:00 UTC+1')).toBe('2025-08-16T14:00:00.000Z')
    expect(parseKickoff('2025-12-26', '20:00 UTC+0')).toBe('2025-12-26T20:00:00.000Z')
    expect(parseKickoff('2025-08-16', '15:00')).toBeNull()
    expect(parseKickoff('2025-08-16', undefined)).toBeNull()
  })

  const season = parseSeason(fixture, 'premier-league', '2025-26', null)
  const [m1, m2, m3] = season.matches

  it('maps statuses honestly: a score means finished, no score means scheduled', () => {
    expect(m1.status).toBe('finished')
    expect(m3.status).toBe('scheduled')
    expect(m3.score).toBeNull() // never 0-0 by default
    expect(m3.kickoffAt).toBeNull()
  })

  it('credits an own goal to the team it counts for, with the scorer from the other side', () => {
    const og = m1.events.find(e => e.type === 'own_goal')!
    expect(og.side).toBe('home')
    expect(og.player?.providerKey).toBe('theo marsh@eastport')
  })

  it('reads penalties, second yellows and substitutions', () => {
    expect(m1.events.find(e => e.type === 'penalty_goal')?.player?.providerKey).toBe('luis pena@eastport')
    expect(m1.events.filter(e => e.type === 'second_yellow')).toHaveLength(1)
    expect(m1.events.filter(e => e.type === 'substitution')).toHaveLength(2)
  })

  it('records extra time and shoot-outs', () => {
    expect(m2.extraTime).toBe(true)
    expect(m2.penalties).toEqual({ home: 4, away: 3 })
  })

  it('keeps player keys scoped to the club', () => {
    expect(m1.lineups?.home.captainKey).toBe('ada okafor@northbridge')
    expect(m1.lineups?.home.starters[0].name).toBe('Ada Okafor')
  })

  it('warns instead of guessing when a name is not in the lineup', () => {
    const broken = structuredClone(fixture)
    broken.matches[0].goals1[0].name = 'Somebody Else'
    const parsed = parseSeason(broken, 'premier-league', '2025-26', null)
    expect(parsed.matches[0].events[0].player).toBeNull()
    expect(parsed.warnings[0].reason).toMatch(/not in the home lineup/)
  })
})
