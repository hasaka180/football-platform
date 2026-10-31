import type { NMatch } from '@/lib/providers/types'

export type PlayerMatchLine = {
  playerKey: string
  side: 'home' | 'away'
  started: boolean
  minuteOn: number
  minuteOff: number
  minutes: number
  goals: number
  penaltyGoals: number
  ownGoals: number
  yellowCards: number
  redCards: number
}

/**
 * Per-player lines for one match: only players who were on the pitch.
 *
 * Minutes follow docs/DECISIONS.md D-003. A starter is on from minute 0 and a
 * substitute from the minute they come on. Either is off at their substitution
 * or sending-off, otherwise at the end of normal time (90, or 120 after extra
 * time). Stoppage time is not counted, because the source doesn't record how
 * long each match lasted.
 */
export function playerMatchLines(m: NMatch): { lines: PlayerMatchLine[]; warnings: string[] } {
  const warnings: string[] = []
  if (!m.lineups || m.status !== 'finished') return { lines: [], warnings }
  const end = m.extraTime ? 120 : 90
  const lines = new Map<string, PlayerMatchLine>()
  const blank = (playerKey: string, side: 'home' | 'away', started: boolean, minuteOn: number): PlayerMatchLine =>
    ({ playerKey, side, started, minuteOn, minuteOff: end, minutes: 0, goals: 0, penaltyGoals: 0, ownGoals: 0, yellowCards: 0, redCards: 0 })

  for (const side of ['home', 'away'] as const) {
    for (const p of m.lineups[side].starters) lines.set(p.providerKey, blank(p.providerKey, side, true, 0))
  }

  // Substitutions in time order: the player coming on starts their spell, the
  // player going off ends theirs (a substitute can later be substituted).
  for (const e of m.events) {
    if (e.type !== 'substitution') continue
    const at = Math.min(e.minute, end)
    if (e.player) {
      if (lines.has(e.player.providerKey)) warnings.push(`${e.playerName} came on twice`)
      else lines.set(e.player.providerKey, blank(e.player.providerKey, e.side, false, at))
    }
    const off = e.off && lines.get(e.off.providerKey)
    if (off) off.minuteOff = Math.min(off.minuteOff, at)
    else warnings.push(`${e.offName} was substituted off without being on the pitch`)
  }

  for (const e of m.events) {
    if (e.type === 'substitution') continue
    const line = e.player && lines.get(e.player.providerKey)
    if (!line) {
      if (e.player) warnings.push(`${e.type} for ${e.playerName}, who wasn't on the pitch`)
      continue
    }
    switch (e.type) {
      case 'goal': line.goals++; break
      case 'penalty_goal': line.goals++; line.penaltyGoals++; break
      case 'own_goal': line.ownGoals++; break
      case 'yellow_card': line.yellowCards++; break
      case 'second_yellow':
      case 'red_card':
        line.redCards++
        line.minuteOff = Math.min(line.minuteOff, Math.min(e.minute, end))
        break
    }
  }

  for (const line of lines.values()) line.minutes = Math.max(0, line.minuteOff - line.minuteOn)
  return { lines: [...lines.values()], warnings }
}
