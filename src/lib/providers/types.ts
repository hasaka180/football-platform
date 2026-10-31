/**
 * Provider-independent shapes. Every adapter turns its source's format into
 * these; nothing downstream (ingestion, database, UI) sees a provider's own
 * response structure. Provider keys are opaque strings that resolve to internal
 * IDs through provider_entity_mappings.
 */

export type MatchStatus =
  | 'scheduled' | 'pre_match' | 'live' | 'halftime' | 'extra_time' | 'penalties'
  | 'suspended' | 'postponed' | 'abandoned' | 'finished' | 'cancelled'

export type SourceCode = 'openfootball' | 'football-data' | 'dev-fixtures'

export interface NCompetition {
  key: string            // our slug, e.g. 'premier-league'
  name: string
  shortName: string
  country: string | null
  kind: 'league' | 'cup'
}

export interface NSeason {
  key: string            // '2025-26'
  name: string           // '2025/26'
  startsOn: string | null
  endsOn: string | null
}

export interface NClub { providerKey: string; name: string }
export interface NPlayer { providerKey: string; name: string }

export interface NLineup {
  starters: NPlayer[]
  bench: NPlayer[]
  captainKey: string | null
}

export interface NMinute { minute: number; added: number | null }

export type NEvent =
  | ({ type: 'goal' | 'penalty_goal'; side: 'home' | 'away'; player: NPlayer | null; playerName: string } & NMinute)
  // An own goal counts for `side`; the scorer plays for the other side.
  | ({ type: 'own_goal'; side: 'home' | 'away'; player: NPlayer | null; playerName: string } & NMinute)
  | ({ type: 'yellow_card' | 'second_yellow' | 'red_card'; side: 'home' | 'away'; player: NPlayer | null; playerName: string } & NMinute)
  | ({ type: 'substitution'; side: 'home' | 'away'; player: NPlayer | null; playerName: string; off: NPlayer | null; offName: string } & NMinute)

export interface NMatch {
  providerKey: string
  round: string | null
  kickoffOn: string                  // YYYY-MM-DD, always present
  kickoffAt: string | null           // ISO 8601 UTC; null when the time is unknown
  home: NClub
  away: NClub
  status: MatchStatus
  score: { home: number; away: number } | null
  halfTime: { home: number; away: number } | null
  extraTime: boolean | null
  penalties: { home: number; away: number } | null
  venue: string | null
  attendance: number | null
  referee: string | null
  lineups: { home: NLineup; away: NLineup } | null
  events: NEvent[]
}

export interface NCompetitionSeason {
  source: SourceCode
  competition: NCompetition
  season: NSeason
  /** When the source itself last changed, if it says. */
  sourceUpdatedAt: string | null
  matches: NMatch[]
  /** Problems found while parsing that didn't stop the import. */
  warnings: { ref: string; reason: string }[]
}

/** What a provider can supply. Feeds src/lib/capabilities.ts. */
export interface ProviderCapabilities {
  fixtures: boolean
  results: boolean
  lineups: boolean
  goals: boolean
  cards: boolean
  standings: boolean
  playerSeasonStats: boolean
}

export interface Provider {
  code: SourceCode
  capabilities: ProviderCapabilities
  /** False when the provider can't run here, e.g. a missing API key. */
  enabled(): boolean
  fetchCompetitionSeason(competitionKey: string, seasonKey: string): Promise<NCompetitionSeason>
}
