import { normalizeClubName } from '@/lib/names'

/**
 * Common names fans search for, keyed by the club's normalised name.
 * Abbreviations and nicknames only; trigram search already handles typos.
 */
const ALIASES: Record<string, string[]> = {
  'manchester united': ['Man Utd', 'Man United', 'MUFC'],
  'manchester city': ['Man City', 'MCFC'],
  'tottenham hotspur': ['Spurs', 'Tottenham'],
  'wolverhampton wanderers': ['Wolves'],
  'brighton hove albion': ['Brighton'],
  'west ham united': ['West Ham'],
  'newcastle united': ['Newcastle'],
  'nottingham forest': ['Forest', 'Nottm Forest'],
  'crystal palace': ['Palace'],
  'aston villa': ['Villa'],
  'leeds united': ['Leeds'],
  'ipswich town': ['Ipswich'],
  'coventry city': ['Coventry'],
  'hull city': ['Hull'],
}

export function clubAliases(name: string): string[] {
  return ALIASES[normalizeClubName(name)] ?? []
}
