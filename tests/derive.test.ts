import { describe, expect, it } from 'vitest'
import fixture from './fixtures/openfootball-mini.json'
import { parseSeason } from '@/lib/providers/openfootball'
import { playerMatchLines } from '@/lib/stats/derive'

const [m1, m2, m3] = parseSeason(fixture, 'premier-league', '2025-26', null).matches
const line = (m: typeof m1, key: string) => playerMatchLines(m).lines.find(l => l.playerKey === key)

describe('player match lines (D-003)', () => {
  it('gives a full-match starter 90 minutes', () => {
    expect(line(m1, 'ada okafor@northbridge')).toMatchObject({ started: true, minutes: 90, goals: 1 })
  })

  it('ends a substituted starter at the substitution', () => {
    expect(line(m1, 'ben hale@northbridge')).toMatchObject({ minuteOn: 0, minuteOff: 60, minutes: 60 })
  })

  it('handles a substitute who is later substituted', () => {
    expect(line(m1, 'lee rhodes@northbridge')).toMatchObject({ started: false, minuteOn: 60, minuteOff: 85, minutes: 25 })
    expect(line(m1, 'max sutton@northbridge')).toMatchObject({ minuteOn: 85, minutes: 5 })
  })

  it('leaves unused substitutes out', () => {
    expect(line(m1, 'ned tate@northbridge')).toBeUndefined()
  })

  it('ends a spell at a sending-off and counts the first yellow separately', () => {
    expect(line(m1, 'oli vance@eastport')).toMatchObject({ minuteOff: 70, minutes: 70, yellowCards: 1, redCards: 1 })
  })

  it('counts an own goal against the scorer, not as a goal', () => {
    expect(line(m1, 'theo marsh@eastport')).toMatchObject({ goals: 0, ownGoals: 1 })
  })

  it('counts a penalty as a goal and a penalty goal', () => {
    expect(line(m1, 'luis pena@eastport')).toMatchObject({ goals: 1, penaltyGoals: 1 })
  })

  it('uses 120 minutes after extra time', () => {
    expect(line(m2, 'ada okafor@northbridge')?.minutes).toBe(120)
    expect(line(m2, 'yan ellis@eastport')).toMatchObject({ minuteOn: 91, minutes: 29 })
    expect(line(m2, 'wes cole@eastport')).toMatchObject({ minutes: 50, redCards: 1 })
  })

  it('produces nothing for a match without a result', () => {
    expect(playerMatchLines(m3).lines).toEqual([])
  })
})
