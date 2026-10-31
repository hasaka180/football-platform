import Link from 'next/link'
import MatchTimeline from '@/components/MatchTimeline'
import SearchBox from '@/components/SearchBox'
import PlayerPhoto, { Credit } from '@/components/PlayerPhoto'
import Sparkline from '@/components/Sparkline'
import { Card, ClubMark, EmptyState, Freshness, Stat } from '@/components/ui'
import { CAPABILITIES } from '@/lib/capabilities'
import { getFeaturedMatchSlug, getGoalProgression, getMatch, getPlayer, getPointsProgression, type MatchDetail, type PlayerPhoto as Photo } from '@/lib/data'
import { fmtDate, fmtInt, fmtMinute } from '@/lib/format'
import { getSeason, getStandings, getTopScorers } from '@/lib/queries'

const per90 = (goals: number, minutes: number) => (minutes > 0 ? (goals * 90) / minutes : null)

export default async function Home() {
  const season = await getSeason('premier-league', '2025-26')
  const [table, scorers] = season ? await Promise.all([getStandings(season.id), getTopScorers(season.id, 10)]) : [[], []]
  const unavailable = Object.values(CAPABILITIES).filter(c => c.status !== 'available' && c.status !== 'partial')
  const champion = table[0]
  const scorer = scorers[0]
  const [pointsLine, goalsLine, featuredSlug] = season && champion && scorer
    ? await Promise.all([getPointsProgression(season.id, champion.clubSlug), getGoalProgression(season.id, scorer.playerSlug), getFeaturedMatchSlug(season.id)])
    : [[], [], null]
  const featured = featuredSlug ? await getMatch(featuredSlug) : null
  const scorerPhoto = scorer ? (await getPlayer(scorer.playerSlug))?.photo ?? null : null

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid grid-cols-1 items-center gap-8 py-10 sm:py-14 lg:grid-cols-[12rem_minmax(0,1fr)_12rem] lg:gap-10">
        {/* Left: the champion's season */}
        {season && champion ? (
          <HeroStat
            align="left"
            line={pointsLine}
            lineLabel={`${champion.club} points by matchday, from ${pointsLine[0]} to ${pointsLine.at(-1)}`}
            value={champion.points}
            caption="Points, champions"
            sub={`${champion.club} · ${season.season}`}
            second={{ value: champion.won, caption: `Wins · ${Math.round((champion.won / champion.played) * 100)}% of matches` }}
            href={`/clubs/${champion.clubSlug}`}
          />
        ) : <div />}

        <div className="order-first min-w-0 text-center lg:order-none">
          <p className="mb-3 text-sm font-medium text-accent">Football intelligence</p>
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">Understand football beyond the score.</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">Every number with the minutes, starts and sample behind it.</p>
          <div className="mx-auto mt-6 max-w-lg text-left"><SearchBox size="lg" /></div>
          {featured && <FeaturedMatch m={featured} />}
        </div>

        {/* Right: the top scorer's season */}
        {season && scorer ? (
          <HeroStat
            align="right"
            line={goalsLine}
            lineLabel={`${scorer.player} cumulative goals across the season, reaching ${goalsLine.at(-1)}`}
            value={scorer.goals}
            caption="Goals, top scorer"
            sub={`${scorer.player} · ${scorer.club}`}
            second={{ value: per90(scorer.goals, scorer.minutes)?.toFixed(2) ?? '—', caption: `Per 90 · ${fmtInt(scorer.minutes)} minutes` }}
            href={`/players/${scorer.playerSlug}`}
            photo={scorerPhoto}
            photoName={scorer.player}
          />
        ) : <div />}
      </section>

      {!season ? (
        <EmptyState title="Season data is not loaded yet">Run the ingestion job to load the 2025/26 Premier League season.</EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{season.competition} {season.season}, in review</h2>
            <Freshness source={season.sourceName} retrievedAt={season.retrievedAt} sourceUpdatedAt={season.sourceUpdatedAt} />
          </div>
          <p className="mb-6 text-sm text-muted">{season.finished} of {season.matches} matches played, with full lineups and events.</p>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <Card title="Final table" eyebrow="Standings" action={{ href: `/competitions/premier-league/${season.seasonSlug}`, label: 'Full season' }}>
              <div className="relative -mx-2 overflow-x-auto">
                <table className="tabular w-full min-w-[480px] text-sm">
                  <caption className="sr-only">{season.competition} {season.season} final table</caption>
                  <thead className="text-xs text-faint">
                    <tr className="text-right">
                      <th scope="col" className="px-2 py-2 text-left font-medium">#</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">Club</th>
                      <th scope="col" className="px-2 py-2 font-medium"><abbr title="Played" className="no-underline">P</abbr></th>
                      <th scope="col" className="px-2 py-2 font-medium"><abbr title="Won" className="no-underline">W</abbr></th>
                      <th scope="col" className="px-2 py-2 font-medium"><abbr title="Drawn" className="no-underline">D</abbr></th>
                      <th scope="col" className="px-2 py-2 font-medium"><abbr title="Lost" className="no-underline">L</abbr></th>
                      <th scope="col" className="px-2 py-2 font-medium"><abbr title="Goal difference" className="no-underline">GD</abbr></th>
                      <th scope="col" className="px-2 py-2 font-medium"><abbr title="Points" className="no-underline">Pts</abbr></th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map(r => (
                      <tr key={r.clubSlug} className="border-t border-line text-right">
                        <td className="px-2 py-2 text-left text-faint">{r.position}</td>
                        <th scope="row" className="px-2 py-2 text-left font-medium">
                          <Link href={`/clubs/${r.clubSlug}`} className="flex items-center gap-2 hover:underline"><ClubMark name={r.club} slug={r.clubSlug} size={22} />{r.club}</Link>
                        </th>
                        <td className="px-2 py-2">{r.played}</td>
                        <td className="px-2 py-2">{r.won}</td>
                        <td className="px-2 py-2">{r.drawn}</td>
                        <td className="px-2 py-2">{r.lost}</td>
                        <td className="px-2 py-2">{r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}</td>
                        <td className="px-2 py-2 font-semibold">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-faint">Computed from results. Ordered by points, then goal difference, then goals scored.</p>
            </Card>

            <Card title="Top scorers" eyebrow="Goals, with context" action={{ href: '/compare', label: 'Compare players' }}>
              <ol className="space-y-1">
                {scorers.map((s, i) => (
                  <li key={s.playerSlug} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-lg px-1 py-2 text-sm">
                    <span className="tabular text-faint">{i + 1}</span>
                    <span className="min-w-0">
                      <Link href={`/players/${s.playerSlug}`} className="block truncate font-medium hover:underline">{s.player}</Link>
                      <span className="block truncate text-xs text-muted">
                        {s.club} · {s.appearances} apps · <span className="tabular">{s.minutes.toLocaleString('en-GB')}</span> min
                        {s.penaltyGoals > 0 && <> · {s.penaltyGoals} pen</>}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tabular block text-lg font-semibold">{s.goals}</span>
                      <span className="block text-xs text-muted"><Stat value={per90(s.goals, s.minutes)} format={n => n.toFixed(2)} /> /90</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-faint">
                Minutes are derived from lineups and substitutions, counting 90 per full match; stoppage time is not included.
              </p>
            </Card>
          </div>
        </>
      )}

      {scorers.length >= 2 && (
        <section className="mt-12 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-sm font-medium text-accent">Player comparison</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Who really had the better season?</h2>
          <p className="mt-2 max-w-2xl text-muted">Compare any two players with the minutes, starts and sample size behind every number.</p>
          <Link href={`/compare/${[scorers[0].playerSlug, scorers[1].playerSlug].sort().join('-vs-')}`} className="mt-5 inline-block rounded-xl bg-accent px-5 py-3 font-medium text-accent-ink">
            {scorers[0].player} vs {scorers[1].player}
          </Link>
          <Link href="/compare" className="ml-4 text-sm text-muted underline-offset-4 hover:text-text hover:underline">Pick your own</Link>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">What we don&apos;t show, and why</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We only publish numbers we can source and explain. These aren&apos;t available from our current data sources, so you won&apos;t see them as zeros or estimates.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {unavailable.map(c => (
            <li key={c.note} className="rounded-xl border border-line p-4 text-sm text-muted">{c.note}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function HeroStat({ align, line, lineLabel, value, caption, sub, second, href, photo, photoName }: {
  align: 'left' | 'right'; line: number[]; lineLabel: string; value: number | string; caption: string; sub: string
  second: { value: number | string; caption: string }; href: string; photo?: Photo | null; photoName?: string
}) {
  const right = align === 'right'
  return (
    <div className={`flex flex-col gap-2 ${right ? 'lg:items-end' : ''}`}>
    <Link href={href} className={`group flex gap-6 max-lg:items-end max-lg:justify-between lg:flex-col ${right ? 'lg:items-end lg:text-right' : ''}`}>
      <div className={`flex flex-col ${right ? 'lg:items-end' : ''}`}>
        {photo && photoName && <PlayerPhoto name={photoName} photo={photo} size={84} rounded="rounded-full" ring="mb-3 ring-2 ring-b/50" />}
        <Sparkline values={line} label={lineLabel} tone={right ? 'var(--b)' : 'var(--a)'} />
        <p className="tabular mt-3 text-5xl font-semibold tracking-tight sm:text-6xl">{value}</p>
        <p className="mt-1 text-sm font-medium">{caption}</p>
        <p className="text-xs text-muted group-hover:text-text">{sub}</p>
      </div>
      <div className={`flex flex-col ${right ? 'max-lg:items-end lg:items-end' : 'max-lg:items-end'}`}>
        <span aria-hidden="true" className="mb-3 hidden h-0.5 w-6 bg-text/70 lg:block" />
        <p className="tabular text-3xl font-semibold tracking-tight">{second.value}</p>
        <p className="text-xs text-muted">{second.caption}</p>
      </div>
    </Link>
    {photo && <Credit photo={photo} className={`max-w-[13rem] ${right ? 'lg:text-right' : ''}`} />}
    </div>
  )
}

function FeaturedMatch({ m }: { m: MatchDetail }) {
  const goals = (side: 'home' | 'away') => m.events.filter(e => e.side === side && (e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal'))
  const scorerText = (side: 'home' | 'away') => goals(side)
    .map(e => `${e.player?.split(' ').at(-1) ?? ''} ${fmtMinute(e.minute, e.added)}${e.type === 'penalty_goal' ? ' pen' : e.type === 'own_goal' ? ' og' : ''}`).join(', ')
  return (
    <section aria-label="Match of the season" className="glass mt-8 rounded-3xl p-5 text-left sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
        <span>Match of the season · {m.competition} {m.season}</span>
        <span>{fmtDate(m.date)}</span>
      </div>
      <Link href={`/matches/${m.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5">
        <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-semibold sm:gap-3 sm:text-xl">
          <span className="line-clamp-2 break-words">{m.home}</span><ClubMark name={m.home} slug={m.homeSlug} size={44} />
        </span>
        <span className="tabular text-3xl font-semibold tracking-tight sm:text-5xl">{m.homeScore}<span className="mx-1 text-faint sm:mx-2">–</span>{m.awayScore}</span>
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:gap-3 sm:text-xl">
          <ClubMark name={m.away} slug={m.awaySlug} size={44} /><span className="line-clamp-2 break-words">{m.away}</span>
        </span>
      </Link>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 text-xs text-muted sm:gap-5">
        <span className="text-right">{scorerText('home')}</span><span className="w-8 text-center text-faint sm:w-16">FT</span><span>{scorerText('away')}</span>
      </div>
      <div className="mt-5"><MatchTimeline m={m} homeLabel={m.home.slice(0, 3)} awayLabel={m.away.slice(0, 3)} /></div>
      <p className="mt-3 text-center text-xs text-faint">
        The highest-scoring meeting between two top-four clubs ·{' '}
        <Link href={`/matches/${m.slug}`} className="underline-offset-4 hover:text-text hover:underline">Full match</Link>
      </p>
    </section>
  )
}
