import 'server-only'
import { canonicalPair, splitPair } from '@/lib/compare'
import { getPlayer, type Player } from '@/lib/data'
import { getSeason, getTopScorers } from '@/lib/queries'

/** Resolves "a-vs-b" to two players, trying each split when a slug contains "-vs-". */
export async function resolvePair(pair: string): Promise<[Player, Player] | null> {
  for (const [a, b] of splitPair(pair)) {
    if (a === b) continue
    const [pa, pb] = await Promise.all([getPlayer(a), getPlayer(b)])
    if (pa && pb) return [pa, pb]
  }
  return null
}

/**
 * Curated pairs: prerendered, indexed and in the sitemap. Others still work
 * but are noindex (docs/SEO.md). Pairs among the season's top scorers, all of
 * whom clear the small-sample threshold.
 */
export async function curatedPairs(): Promise<string[]> {
  const season = await getSeason('premier-league', '2025-26')
  if (!season) return []
  const top = (await getTopScorers(season.id, 10)).filter(s => s.minutes >= 900)
  const out: string[] = []
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) out.push(canonicalPair(top[i].playerSlug, top[j].playerSlug))
  return out
}
