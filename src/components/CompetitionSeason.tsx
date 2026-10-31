import Link from 'next/link'
import { notFound } from 'next/navigation'
import MatchList from '@/components/MatchList'
import { Breadcrumbs, JsonLd } from '@/components/page-bits'
import { Card, ClubMark, EmptyState, Freshness } from '@/components/ui'
import { getCompetition, getSeasonMatches, getToday } from '@/lib/data'
import { fmtInt } from '@/lib/format'
import { getStandings, getTopScorers } from '@/lib/queries'
import { SITE } from '@/lib/site'

/** One competition season: table, scorers, results, fixtures. Shared by both competition routes. */
export default async function CompetitionSeason({ slug, seasonSlug }: { slug: string; seasonSlug?: string }) {
  const comp = await getCompetition(slug)
  if (!comp || !comp.seasons.length) notFound()
  const season = seasonSlug ? comp.seasons.find(s => s.seasonSlug === seasonSlug) : comp.seasons[0]
  if (!season) notFound()

  const [table, scorers, matches, today] = await Promise.all([
    getStandings(season.csId), season.withLineups ? getTopScorers(season.csId, 15) : Promise.resolve([]), getSeasonMatches(season.csId), getToday(),
  ])
  const complete = season.finished === season.matches
  const results = matches.filter(m => m.homeScore !== null).slice(-10).reverse()
  const upcoming = matches.filter(m => m.homeScore === null && m.status === 'scheduled' && m.date >= today).slice(0, 10)
  const rounds = [...new Set(matches.map(m => m.round ?? ''))]
  const path = `/competitions/${comp.slug}/${season.seasonSlug}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: comp.name, href: `/competitions/${comp.slug}` }, ...(seasonSlug ? [{ label: season.season, href: path }] : [])]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'SportsOrganization', name: comp.name, sport: 'Football', url: `${SITE.url}/competitions/${comp.slug}` }} />

      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{comp.name} {season.season}</h1>
        <p className="mt-2 text-sm text-muted">
          {season.finished} of {season.matches} matches played{season.withLineups ? ', with full lineups and events' : ''}.
          {!complete && season.lastResultOn && <> Latest result published: {season.lastResultOn}.</>}
        </p>
        <div className="mt-2"><Freshness source={season.sourceName} retrievedAt={season.retrievedAt} sourceUpdatedAt={season.sourceUpdatedAt} staleAfterDays={complete ? undefined : 7} /></div>
        {comp.seasons.length > 1 && (
          <nav aria-label="Seasons" className="mt-4 flex flex-wrap gap-2">
            {comp.seasons.map(s => (
              <Link key={s.csId} href={`/competitions/${comp.slug}/${s.seasonSlug}`} aria-current={s.csId === season.csId ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${s.csId === season.csId ? 'border-accent text-accent' : 'border-line text-muted hover:text-text'}`}>
                {s.season}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {!complete && season.withLineups === 0 && (
        <p role="note" className="mb-6 rounded-xl border border-line-strong px-4 py-3 text-sm text-muted">
          Player statistics for this season aren&apos;t available yet: our free sources publish full lineups only for completed seasons.
          Results here may lag behind real life; see the update date above.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card title={complete ? 'Final table' : 'Table'} eyebrow={complete ? 'Standings' : `After ${season.finished} published results`}>
          {table.length === 0 ? <EmptyState title="No results yet" /> : (
            <div className="relative -mx-2 overflow-x-auto">
              <table className="tabular w-full min-w-[520px] text-sm">
                <caption className="sr-only">{comp.name} {season.season} table</caption>
                <thead className="text-xs text-faint">
                  <tr className="text-right">
                    <th scope="col" className="px-2 py-2 text-left font-medium">#</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">Club</th>
                    {['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'].map(h => <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {table.map(r => (
                    <tr key={r.clubSlug} className="border-t border-line text-right">
                      <td className="px-2 py-2 text-left text-faint">{r.position}</td>
                      <th scope="row" className="px-2 py-2 text-left font-medium">
                        <Link href={`/clubs/${r.clubSlug}`} className="flex items-center gap-2 hover:underline"><ClubMark name={r.club} slug={r.clubSlug} size={20} />{r.club}</Link>
                      </th>
                      <td className="px-2 py-2">{r.played}</td><td className="px-2 py-2">{r.won}</td><td className="px-2 py-2">{r.drawn}</td><td className="px-2 py-2">{r.lost}</td>
                      <td className="px-2 py-2">{r.goalsFor}</td><td className="px-2 py-2">{r.goalsAgainst}</td>
                      <td className="px-2 py-2">{r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}</td>
                      <td className="px-2 py-2 font-semibold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-faint">Computed from published results: points, then goal difference, then goals scored. Official tie-breakers beyond these are not applied.</p>
        </Card>

        <div className="space-y-6">
          {scorers.length > 0 && (
            <Card title="Top scorers">
              <ol className="text-sm">
                {scorers.map((s, i) => (
                  <li key={s.playerSlug} className="grid grid-cols-[1.5rem_1fr_auto] gap-2 border-t border-line py-1.5 first:border-0">
                    <span className="tabular text-faint">{i + 1}</span>
                    <span className="min-w-0 truncate"><Link href={`/players/${s.playerSlug}`} className="font-medium hover:underline">{s.player}</Link> <span className="text-muted">· {s.club}</span></span>
                    <span className="tabular text-right"><span className="font-semibold">{s.goals}</span> <span className="text-xs text-faint">{fmtInt(s.minutes)}′</span></span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {upcoming.length > 0 && <Card title="Upcoming fixtures"><MatchList matches={upcoming} today={today} /></Card>}
          <Card title="Latest results"><MatchList matches={results} today={today} /></Card>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">All matches</h2>
        <div className="space-y-2">
          {rounds.map(r => (
            <details key={r} className="rounded-xl border border-line bg-surface px-4 py-2">
              <summary className="cursor-pointer py-1 text-sm font-medium">{r || 'Matches'}</summary>
              <div className="pb-2"><MatchList matches={matches.filter(m => (m.round ?? '') === r)} today={today} /></div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
