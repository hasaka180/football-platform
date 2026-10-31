import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CompetitionSeason from '@/components/CompetitionSeason'
import { getCompetition, listSlugs } from '@/lib/data'

// See docs/DECISIONS.md D-010.
export const instant = false

export async function generateStaticParams() {
  return (await listSlugs()).competitions.flatMap(c => c.seasons.map(season => ({ slug: c.slug, season })))
}

export async function generateMetadata({ params }: PageProps<'/competitions/[slug]/[season]'>): Promise<Metadata> {
  const { slug, season } = await params
  const c = await getCompetition(slug)
  const s = c?.seasons.find(x => x.seasonSlug === season)
  if (!c || !s) notFound()
  return {
    title: `${c.name} ${s.season}: table, results and scorers`,
    description: `${c.name} ${s.season} table, results and fixtures${s.withLineups ? ', with player statistics' : ''}.`,
    alternates: { canonical: `/competitions/${c.slug}/${s.seasonSlug}` },
  }
}

export default async function CompetitionSeasonPage({ params }: PageProps<'/competitions/[slug]/[season]'>) {
  const { slug, season } = await params
  return <CompetitionSeason slug={slug} seasonSlug={season} />
}
