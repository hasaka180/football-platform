/**
 * Club identity for badges: traditional club colours and the standard
 * three-letter code. These are facts, not artwork, so they carry none of the
 * rights restrictions of official crests (docs/LICENSING.md). Keyed by club
 * slug. A club missing here gets a neutral badge rather than guessed colours.
 *
 * bg = main colour, fg = text colour chosen for contrast, accent = second colour.
 */
export type ClubIdentity = { code: string; bg: string; fg: string; accent: string }

export const CLUB_IDENTITY: Record<string, ClubIdentity> = {
  // Premier League
  arsenal: { code: 'ARS', bg: '#DB0007', fg: '#FFFFFF', accent: '#FFFFFF' },
  'aston-villa': { code: 'AVL', bg: '#670E36', fg: '#FFFFFF', accent: '#95BFE5' },
  bournemouth: { code: 'BOU', bg: '#B50E12', fg: '#FFFFFF', accent: '#000000' },
  brentford: { code: 'BRE', bg: '#E30613', fg: '#FFFFFF', accent: '#000000' },
  'brighton-hove-albion': { code: 'BHA', bg: '#0057B8', fg: '#FFFFFF', accent: '#FFFFFF' },
  burnley: { code: 'BUR', bg: '#6C1D45', fg: '#FFFFFF', accent: '#99D6EA' },
  chelsea: { code: 'CHE', bg: '#034694', fg: '#FFFFFF', accent: '#FFFFFF' },
  'coventry-city': { code: 'COV', bg: '#59CBE8', fg: '#0B1F3A', accent: '#FFFFFF' },
  'crystal-palace': { code: 'CRY', bg: '#1B458F', fg: '#FFFFFF', accent: '#C4122E' },
  everton: { code: 'EVE', bg: '#003399', fg: '#FFFFFF', accent: '#FFFFFF' },
  fulham: { code: 'FUL', bg: '#FFFFFF', fg: '#000000', accent: '#000000' },
  'hull-city': { code: 'HUL', bg: '#F18A01', fg: '#000000', accent: '#000000' },
  'ipswich-town': { code: 'IPS', bg: '#0044A9', fg: '#FFFFFF', accent: '#FFFFFF' },
  'leeds-united': { code: 'LEE', bg: '#FFFFFF', fg: '#1D428A', accent: '#FFCD00' },
  liverpool: { code: 'LIV', bg: '#C8102E', fg: '#FFFFFF', accent: '#00B2A9' },
  'manchester-city': { code: 'MCI', bg: '#6CABDD', fg: '#1C2C5B', accent: '#FFFFFF' },
  'manchester-united': { code: 'MUN', bg: '#DA291C', fg: '#FFFFFF', accent: '#FBE122' },
  'newcastle-united': { code: 'NEW', bg: '#241F20', fg: '#FFFFFF', accent: '#FFFFFF' },
  'nottingham-forest': { code: 'NFO', bg: '#DD0000', fg: '#FFFFFF', accent: '#FFFFFF' },
  sunderland: { code: 'SUN', bg: '#EB172B', fg: '#FFFFFF', accent: '#000000' },
  'tottenham-hotspur': { code: 'TOT', bg: '#FFFFFF', fg: '#132257', accent: '#132257' },
  'west-ham-united': { code: 'WHU', bg: '#7A263A', fg: '#FFFFFF', accent: '#1BB1E7' },
  'wolverhampton-wanderers': { code: 'WOL', bg: '#FDB913', fg: '#000000', accent: '#000000' },
  // Champions League
  'as-roma': { code: 'ROM', bg: '#8E1F2F', fg: '#F0BC42', accent: '#F0BC42' },
  'borussia-dortmund': { code: 'BVB', bg: '#FDE100', fg: '#000000', accent: '#000000' },
  'club-atletico-de-madrid': { code: 'ATM', bg: '#CB3524', fg: '#FFFFFF', accent: '#272E61' },
  'club-brugge-kv': { code: 'BRU', bg: '#0067B1', fg: '#FFFFFF', accent: '#000000' },
  'como-1907': { code: 'COM', bg: '#1E3C78', fg: '#FFFFFF', accent: '#FFFFFF' },
  'fc-barcelona': { code: 'BAR', bg: '#004D98', fg: '#FFFFFF', accent: '#A50044' },
  'fc-bayern-munchen': { code: 'FCB', bg: '#DC052D', fg: '#FFFFFF', accent: '#0066B2' },
  'fc-internazionale-milano': { code: 'INT', bg: '#0A1F8F', fg: '#FFFFFF', accent: '#000000' },
  'fc-porto': { code: 'POR', bg: '#00428C', fg: '#FFFFFF', accent: '#FFFFFF' },
  'fenerbahce-sk': { code: 'FEN', bg: '#FFED00', fg: '#163962', accent: '#163962' },
  'feyenoord-rotterdam': { code: 'FEY', bg: '#E1001A', fg: '#FFFFFF', accent: '#FFFFFF' },
  'fk-bod-glimt': { code: 'BOD', bg: '#FFE500', fg: '#000000', accent: '#000000' },
  'fk-shakhtar-donetsk': { code: 'SHA', bg: '#FF6600', fg: '#000000', accent: '#000000' },
  'galatasaray-sk': { code: 'GAL', bg: '#A90432', fg: '#FDB912', accent: '#FDB912' },
  'lask-linz': { code: 'LAS', bg: '#000000', fg: '#FFFFFF', accent: '#FFFFFF' },
  'lille-osc': { code: 'LIL', bg: '#E01E13', fg: '#FFFFFF', accent: '#24216A' },
  'pae-aek': { code: 'AEK', bg: '#FFD200', fg: '#000000', accent: '#000000' },
  'paris-saint-germain': { code: 'PSG', bg: '#004170', fg: '#FFFFFF', accent: '#DA291C' },
  psv: { code: 'PSV', bg: '#ED1C24', fg: '#FFFFFF', accent: '#FFFFFF' },
  'racing-club-de-lens': { code: 'RCL', bg: '#E30613', fg: '#FFD700', accent: '#FFD700' },
  'rb-leipzig': { code: 'RBL', bg: '#FFFFFF', fg: '#DD0741', accent: '#001F47' },
  'real-betis-balompie': { code: 'BET', bg: '#00954C', fg: '#FFFFFF', accent: '#FFFFFF' },
  'real-madrid-cf': { code: 'RMA', bg: '#FFFFFF', fg: '#1E2A78', accent: '#FEBE10' },
  'sk-slavia-praha': { code: 'SLA', bg: '#DA291C', fg: '#FFFFFF', accent: '#FFFFFF' },
  'sk-slovan-bratislava': { code: 'SLO', bg: '#4FA0DC', fg: '#0A2240', accent: '#FFFFFF' },
  'sporting-clube-de-portugal': { code: 'SCP', bg: '#008057', fg: '#FFFFFF', accent: '#FFFFFF' },
  'ssc-napoli': { code: 'NAP', bg: '#12A0D7', fg: '#0B2341', accent: '#FFFFFF' },
  'vfb-stuttgart': { code: 'VFB', bg: '#FFFFFF', fg: '#E32219', accent: '#E32219' },
  'viking-fk': { code: 'VIK', bg: '#002B5C', fg: '#FFFFFF', accent: '#FFFFFF' },
  'villarreal-cf': { code: 'VIL', bg: '#FBE10F', fg: '#005187', accent: '#005187' },
}
