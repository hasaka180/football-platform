/**
 * The feature capability matrix (docs/FREE_DATA_PROVIDERS.md) in code. Pages
 * check this before rendering a module, and use the reason in empty states,
 * so nothing is shown that the data can't back.
 */

export type Capability =
  | { status: 'available'; source: string; note?: string }
  | { status: 'partial'; source: string; note: string }
  | { status: 'unavailable' | 'licensing_blocked' | 'not_verified'; note: string }

const footballDataKey = () => Boolean(process.env.FOOTBALL_DATA_API_KEY)

export const CAPABILITIES = {
  'pl.2025-26.results': { status: 'available', source: 'openfootball' },
  'pl.2025-26.lineups': { status: 'available', source: 'openfootball' },
  'pl.2025-26.standings': { status: 'available', source: 'openfootball', note: 'Computed from results: points, goal difference, goals scored.' },
  'pl.2025-26.player-stats': { status: 'available', source: 'openfootball', note: 'Appearances, starts, minutes, goals and cards derived from lineups and events.' },
  'pl.current.fixtures': footballDataKey()
    ? { status: 'available', source: 'football-data' }
    : { status: 'partial', source: 'openfootball', note: 'Published schedule only; results may lag by weeks.' },
  'ucl.fixtures': { status: 'not_verified', note: 'Planned from football-data.org and openfootball (Phase 2).' },
  assists: { status: 'unavailable', note: 'Assists are not published by our free data sources.' },
  positions: { status: 'unavailable', note: 'Player positions are not published by our free data sources.' },
  'player-bio': { status: 'unavailable', note: 'Age and nationality are not published by our free data sources.' },
  'advanced-metrics': { status: 'unavailable', note: 'Shots, passes, tackles and expected goals need a paid data source.' },
  live: { status: 'unavailable', note: 'Free data is delayed, so we do not show live scores.' },
  'player-photos': { status: 'licensing_blocked', note: 'Player photos and club crests are owned by third parties.' },
} satisfies Record<string, Capability>

export type CapabilityKey = keyof typeof CAPABILITIES

export function capability(key: CapabilityKey): Capability {
  return CAPABILITIES[key]
}

export function isAvailable(key: CapabilityKey): boolean {
  return CAPABILITIES[key].status === 'available'
}
