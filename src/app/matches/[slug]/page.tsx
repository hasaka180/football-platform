import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MatchTimeline from '@/components/MatchTimeline'
import { Breadcrumbs, JsonLd } from '@/components/page-bits'
import { Card, ClubMark, EmptyState, Freshness } from '@/components/ui'
import { getMatch, getToday, listSlugs, type MatchDetail } from '@/lib/data'
import { fmtDate, fmtInt, fmtMinute, fmtTimeUtc } from '@/lib/format'
import { SITE } from '@/lib/site'

// See docs/DECISIONS.md D-010.
export const instant = false

export async function generateStaticParams() {
  return (await listSlugs()).matches.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<'/matches/[slug]'>): Promise<Metadata> {
  const m = await getMatch((await params).slug)
  if (!m) notFound()
  const score = m.homeScore !== null ? ` ${m.homeScore}–${m.awayScore}` : ''
  return {
    title: `${m.home}${score} ${m.away}, ${fmtDate(m.date)}`,
    description: `${m.home} v ${m.away}, ${m.competition} ${m.season}${m.hasLineups ? ': lineups, goals, cards and substitutions' : ''}.`,
    alternates: { canonical: `/matches/${m.slug}` },
    // Index finished matches with real detail; thin fixtures stay out (docs/SEO.md).
    robots: m.status === 'finished' && m.hasLineups ? undefined : { index: false, follow: true },
  }
}

const EVENT_LABEL: Record<string, string> = {
  goal: 'Goal', penalty_goal: 'Penalty', own_goal: 'Own goal', yellow_card: 'Yellow card',
  second_yellow: 'Second yellow', red_card: 'Red card', substitution: 'Substitution',
}

function EventIcon({ type }: { type: string }) {
  if (type === 'goal' || type === 'penalty_goal' || type === 'own_goal') return <span aria-hidden="true">⚽</span>
  if (type === 'yellow_card') return <span aria-hidden="true" className="inline-block h-3.5 w-2.5 rounded-sm bg-warn" />
  if (type === 'red_card' || type === 'second_yellow') return <span aria-hidden="true" className="inline-block h-3.5 w-2.5 rounded-sm bg-bad" />
  return <span aria-hidden="true" className="text-faint">⇄</span>
}

function Lineup({ m, side }: { m: MatchDetail; side: 'home' | 'away' }) {
  const rows = m.lineups.filter(l => l.side === side)
  const block = (role: 'starter' | 'bench', title: string) => (
    <>
      <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wider text-faint first:mt-0">{title}</h3>
      <ul className="text-sm">
        {rows.filter(l => l.role === role).map(l => (
          <li key={l.playerSlug} className="flex justify-between gap-3 border-t border-line py-1.5">
            <Link href={`/players/${l.playerSlug}`} className="hover:underline">{l.player}{l.captain && <span className="text-faint" title="Captain"> (c)</span>}</Link>
            <span className="tabular text-xs text-muted">
              {l.minutes === null ? 'Unused' : role === 'bench' ? `On ${l.minuteOn}’` : l.minuteOff !== null && l.minuteOff < (m.extraTime ? 120 : 90) ? `Off ${l.minuteOff}’` : ''}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
  return <div>{block('starter', 'Starting XI')}{block('bench', 'Substitutes')}</div>
}

export default async function MatchPage({ params }: PageProps<'/matches/[slug]'>) {
  const m = await getMatch((await params).slug)
  if (!m) notFound()
  const played = m.homeScore !== null && m.awayScore !== null
  const today = await getToday()
  const pending = !played && m.status === 'scheduled' && m.date < today

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: `${m.competition} ${m.season}`, href: `/competitions/${m.competitionSlug}/${m.seasonSlug}` }, { label: `${m.home} v ${m.away}`, href: `/matches/${m.slug}` }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'SportsEvent', name: `${m.home} v ${m.away}`, sport: 'Football',
        startDate: m.kickoffAt ?? m.date, url: `${SITE.url}/matches/${m.slug}`,
        eventStatus: m.status === 'postponed' ? 'https://schema.org/EventPostponed' : m.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
        homeTeam: { '@type': 'SportsTeam', name: m.home }, awayTeam: { '@type': 'SportsTeam', name: m.away },
        ...(m.venue ? { location: { '@type': 'Place', name: m.venue } } : {}) }} />

      <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8" aria-label="Score">
        <p className="text-center text-xs text-faint">{m.competition} · {m.round ?? m.season} · {fmtDate(m.date)} · {fmtTimeUtc(m.kickoffAt)}</p>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link href={`/clubs/${m.homeSlug}`} className="flex flex-col items-center gap-2 text-center font-semibold hover:underline sm:flex-row sm:justify-end">
            <ClubMark name={m.home} slug={m.homeSlug} size={40} />{m.home}
          </Link>
          <div className="tabular text-center">
            {played ? (
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl"><span className="sr-only">{m.home} </span>{m.homeScore}–{m.awayScore}<span className="sr-only"> {m.away}</span></h1>
            ) : (
              <h1 className="text-xl font-semibold text-muted"><span className="sr-only">{m.home} v {m.away}: </span>{m.status === 'postponed' ? 'Postponed' : m.status === 'cancelled' ? 'Cancelled' : 'v'}</h1>
            )}
            {m.homeScoreHt !== null && <p className="mt-1 text-xs text-muted">Half-time {m.homeScoreHt}–{m.awayScoreHt}</p>}
            {m.extraTime && <p className="text-xs text-muted">After extra time</p>}
            {m.homePenalties !== null && <p className="text-xs text-muted">Penalties {m.homePenalties}–{m.awayPenalties}</p>}
          </div>
          <Link href={`/clubs/${m.awaySlug}`} className="flex flex-col-reverse items-center gap-2 text-center font-semibold hover:underline sm:flex-row sm:justify-start">
            {m.away}<ClubMark name={m.away} slug={m.awaySlug} size={40} />
          </Link>
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          {[m.venue, m.attendance ? `Attendance ${fmtInt(m.attendance)}` : null, m.referee ? `Referee ${m.referee}` : null].filter(Boolean).join(' · ') || 'Venue and officials not published'}
        </p>
      </section>

      {m.hasLineups && m.events.length > 0 && (
        <div className="mt-4"><MatchTimeline m={m} homeLabel={m.home.slice(0, 3)} awayLabel={m.away.slice(0, 3)} /></div>
      )}

      {pending && (
        <div className="mt-6">
          <EmptyState title="Result not available yet">This match date has passed, but our source hasn&apos;t published the result. We don&apos;t show scores we can&apos;t verify.</EmptyState>
          <div className="mt-2"><Freshness source={m.sourceName} retrievedAt={null} sourceUpdatedAt={m.sourceUpdatedAt} /></div>
        </div>
      )}

      {m.hasLineups ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr_1fr]">
          <Card title={m.home}><Lineup m={m} side="home" /></Card>
          <Card title="Timeline">
            {m.events.length === 0 ? <p className="text-sm text-muted">No goals, cards or substitutions recorded.</p> : (
              <ol className="space-y-2 text-sm">
                {m.events.map(e => (
                  <li key={e.seq} className={`flex items-start gap-2 ${e.side === 'away' ? 'flex-row-reverse text-right' : ''}`}>
                    <span className="tabular w-10 shrink-0 text-xs text-faint">{fmtMinute(e.minute, e.added)}</span>
                    <EventIcon type={e.type} />
                    <span>
                      <span className="sr-only">{EVENT_LABEL[e.type]}: </span>
                      {e.playerSlug ? <Link href={`/players/${e.playerSlug}`} className="hover:underline">{e.player}</Link> : e.player}
                      {e.type === 'penalty_goal' && <span className="text-faint"> (pen)</span>}
                      {e.type === 'own_goal' && <span className="text-faint"> (og)</span>}
                      {e.type === 'substitution' && e.related && <span className="block text-xs text-muted">for {e.related}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title={m.away}><Lineup m={m} side="away" /></Card>
        </div>
      ) : !pending && (
        <div className="mt-6">
          <EmptyState title="Official lineup not available">Lineups and match events are only available for matches covered in full by our sources.</EmptyState>
        </div>
      )}
      <p className="mt-6 text-xs text-faint">Source: {m.sourceName}. Times shown in UTC.</p>
    </div>
  )
}
