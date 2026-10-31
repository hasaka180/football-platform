import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CompetitionSeason from '@/components/CompetitionSeason'
import { getCompetition, listSlugs } from '@/lib/data'

// See docs/DECISIONS.md D-010.
export const instant = false

export async function generateStaticParams() {
  return (await listSlugs()).competitions.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: PageProps<'/competitions/[slug]'>): Promise<Metadata> {
  const c = await getCompetition((await params).slug)
  if (!c || !c.seasons.length) notFound()
  return {
    title: `${c.name} table, results and top scorers`,
    description: `${c.name} ${c.seasons[0].season}: table, results, fixtures and player statistics with minutes and per-90 context.`,
    alternates: { canonical: `/competitions/${c.slug}` },
  }
}

export default async function CompetitionPage({ params }: PageProps<'/competitions/[slug]'>) {
  return <CompetitionSeason slug={(await params).slug} />
}
