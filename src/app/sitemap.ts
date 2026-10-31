import type { MetadataRoute } from 'next'
import { curatedPairs } from '@/lib/compare-data'
import { listSlugs } from '@/lib/data'
import { SITE } from '@/lib/site'

/**
 * Only indexable pages with real content (docs/SEO.md): players with
 * appearances, clubs, competition seasons, finished matches with lineups, and
 * curated comparisons. Arbitrary comparisons and thin fixtures stay out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, pairs] = await Promise.all([listSlugs(), curatedPairs()])
  const u = (path: string, changeFrequency: 'daily' | 'weekly' | 'monthly', priority: number) => ({ url: `${SITE.url}${path}`, changeFrequency, priority })
  return [
    u('/', 'daily', 1),
    u('/compare', 'weekly', 0.8),
    ...slugs.competitions.flatMap(c => [u(`/competitions/${c.slug}`, 'daily', 0.9), ...c.seasons.map(s => u(`/competitions/${c.slug}/${s}`, 'weekly', 0.7))]),
    ...slugs.clubs.map(s => u(`/clubs/${s}`, 'weekly', 0.7)),
    ...slugs.players.map(s => u(`/players/${s}`, 'weekly', 0.6)),
    ...pairs.map(p => u(`/compare/${p}`, 'monthly', 0.6)),
    ...slugs.indexableMatches.map(s => u(`/matches/${s}`, 'monthly', 0.4)),
  ]
}
