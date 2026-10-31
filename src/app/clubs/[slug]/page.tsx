import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MatchList from '@/components/MatchList'
import { Breadcrumbs, Figure, JsonLd } from '@/components/page-bits'
import { Card, ClubMark, Freshness } from '@/components/ui'
import { getClub, getCompetition, getSeasonMatches, getSquad, getToday, listSlugs } from '@/lib/data'
import { fmtInt } from '@/lib/format'
import { getStandings } from '@/lib/queries'
import { SITE } from '@/lib/site'

// See docs/DECISIONS.md D-010.
export const instant = false

export async function generateStaticParams() {
  return (await listSlugs()).clubs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<'/clubs/[slug]'>): Promise<Metadata> {
  const c = await getClub((await params).slug)
  if (!c) notFound()
  return {
    title: `${c.shortName}: results, table and squad stats`,
    description: `${c.shortName} results, fixtures, league position and player statistics with minutes and per-90 context.`,
    alternates: { canonical: `/clubs/${c.slug}` },
  }
}

export default async function ClubPage({ params }: PageProps<'/clubs/[slug]'>) {
  const club = await getClub((await params).slug)
  if (!club) notFound()
  const today = await getToday()

  const seasons = await Promise.all(club.seasons.map(async s => {
    const [matches, table, squad, comp] = await Promise.all([
      getSeasonMatches(s.csId, club.id), getStandings(s.csId), s.hasLineups ? getSquad(club.id, s.csId) : Promise.resolve([]), getCompetition(s.competitionSlug),
    ])
    return { ...s, matches, row: table.find(r => r.clubSlug === club.slug), squad, info: comp?.seasons.find(x => x.csId === s.csId) }
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: club.shortName, href: `/clubs/${club.slug}` }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'SportsTeam', name: club.name, sport: 'Football', url: `${SITE.url}/clubs/${club.slug}` }} />
      <header className="mb-8 flex items-center gap-4">
        <ClubMark name={club.shortName} slug={club.slug} size={56} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{club.shortName}</h1>
          <p className="mt-1 text-sm text-muted">{[...new Set(club.seasons.map(s => s.competition))].join(' · ')}</p>
        </div>
      </header>

      <div className="space-y-10">
        {seasons.map(s => {
          const finished = s.matches.filter(m => m.homeScore !== null)
          const upcoming = s.matches.filter(m => m.homeScore === null && m.date >= today && m.status === 'scheduled').slice(0, 5)
          const complete = s.info ? s.info.finished === s.info.matches : false
          return (
            <section key={s.csId} aria-labelledby={`s-${s.csId}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`s-${s.csId}`} className="text-xl font-semibold tracking-tight">
                  <Link href={`/competitions/${s.competitionSlug}/${s.seasonSlug}`} className="hover:underline">{s.competition} {s.season}</Link>
                </h2>
                {s.info && <Freshness source={s.info.sourceName} retrievedAt={s.info.retrievedAt} sourceUpdatedAt={s.info.sourceUpdatedAt} staleAfterDays={complete ? undefined : 7} />}
              </div>

              {s.row && (
                <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Figure label={complete ? 'Final position' : 'Position'} value={s.row.position} note={complete ? undefined : `after ${s.row.played} matches`} />
                  <Figure label="Points" value={s.row.points} />
                  <Figure label="Record" value={`${s.row.won}-${s.row.drawn}-${s.row.lost}`} note="Won-drawn-lost" />
                  <Figure label="Goals" value={`${s.row.goalsFor}:${s.row.goalsAgainst}`} note="For : against" />
                </dl>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title={upcoming.length ? 'Results and next fixtures' : 'Results'}>
                  <MatchList matches={[...finished.slice(-8), ...upcoming]} today={today} highlight={club.slug} />
                  {!complete && s.info?.lastResultOn && (
                    <p className="mt-3 text-xs text-faint">Latest result published by the source: {s.info.lastResultOn}.</p>
                  )}
                </Card>
                {s.squad.length > 0 ? (
                  <Card title="Squad statistics" eyebrow="Players used">
                    <div className="relative -mx-2 max-h-[28rem] overflow-auto">
                      <table className="tabular w-full text-sm">
                        <caption className="sr-only">{club.shortName} player statistics, {s.season}</caption>
                        <thead className="sticky top-0 bg-surface text-xs text-faint">
                          <tr className="text-right">
                            <th scope="col" className="px-2 py-2 text-left font-medium">Player</th>
                            <th scope="col" className="px-2 py-2 font-medium"><abbr title="Appearances (starts)" className="no-underline">Apps</abbr></th>
                            <th scope="col" className="px-2 py-2 font-medium">Min</th>
                            <th scope="col" className="px-2 py-2 font-medium">Goals</th>
                            <th scope="col" className="px-2 py-2 font-medium"><abbr title="Goals per 90 minutes" className="no-underline">/90</abbr></th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.squad.map(p => (
                            <tr key={p.playerSlug} className="border-t border-line text-right">
                              <th scope="row" className="px-2 py-1.5 text-left font-normal"><Link href={`/players/${p.playerSlug}`} className="hover:underline">{p.player}</Link></th>
                              <td className="px-2 py-1.5">{p.appearances} <span className="text-faint">({p.starts})</span></td>
                              <td className="px-2 py-1.5">{fmtInt(p.minutes)}</td>
                              <td className="px-2 py-1.5">{p.goals || ''}</td>
                              <td className={`px-2 py-1.5 ${p.minutes < 900 ? 'text-faint' : ''}`}>{p.goals && p.minutes ? ((p.goals * 90) / p.minutes).toFixed(2) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-xs text-faint">Per-90 rates under 900 minutes are greyed out as small samples.</p>
                  </Card>
                ) : (
                  <Card title="Squad statistics">
                    <p className="text-sm text-muted">Lineups for this season aren&apos;t published by our sources yet, so we can&apos;t show player statistics.</p>
                  </Card>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
