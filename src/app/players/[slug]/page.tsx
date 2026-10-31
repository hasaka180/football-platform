import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs, Figure, JsonLd, ResultChip } from '@/components/page-bits'
import PlayerPhoto, { Credit } from '@/components/PlayerPhoto'
import { Card, ClubMark, EmptyState, Stat } from '@/components/ui'
import { capability } from '@/lib/capabilities'
import { SMALL_SAMPLE_MINUTES } from '@/lib/compare'
import { getPlayer, getPlayerMatchLog, listSlugs } from '@/lib/data'
import { fmtDate, fmtInt } from '@/lib/format'
import { SITE } from '@/lib/site'

export async function generateStaticParams() {
  return (await listSlugs()).players.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<'/players/[slug]'>): Promise<Metadata> {
  const p = await getPlayer((await params).slug)
  if (!p) notFound() // a real 404 status before anything streams
  const s = p.seasons[0]
  const description = s
    ? `${p.name} ${s.season} ${s.competition} statistics for ${s.club}: ${s.appearances} appearances, ${fmtInt(s.minutes)} minutes, ${s.goals} goals, with per-90 context.`
    : `${p.name}: football statistics.`
  return {
    title: `${p.name} stats`,
    description,
    alternates: { canonical: `/players/${p.slug}` },
    // Index only players with real playing time (docs/SEO.md).
    robots: p.seasons.some(x => x.appearances > 0) ? undefined : { index: false },
  }
}

// Blocking on purpose: known slugs are prerendered (generateStaticParams), and an
// unknown slug must return a real 404 status, which streaming would turn into a
// 200 with a not-found body (docs/DECISIONS.md D-010).
export const instant = false

export default async function PlayerPage({ params }: PageProps<'/players/[slug]'>) {
  const { slug } = await params
  const player = await getPlayer(slug)
  if (!player) notFound()
  const latest = player.seasons[0]
  const log = latest ? await getPlayerMatchLog(player.id, latest.csId) : []
  const per90 = latest && latest.minutes > 0 ? (latest.goals * 90) / latest.minutes : null
  const small = latest ? latest.minutes < SMALL_SAMPLE_MINUTES : false

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, ...(latest ? [{ label: latest.club, href: `/clubs/${latest.clubSlug}` }] : []), { label: player.name, href: `/players/${player.slug}` }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Person', name: player.name, url: `${SITE.url}/players/${player.slug}`,
        ...(player.photo ? { image: player.photo.url } : {}),
        ...(latest ? { memberOf: { '@type': 'SportsTeam', name: latest.club, url: `${SITE.url}/clubs/${latest.clubSlug}` } } : {}) }} />

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <PlayerPhoto name={player.name} photo={player.photo} size={104} rounded="rounded-3xl" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{player.name}</h1>
            {latest && (
              <p className="mt-1 flex items-center gap-2 text-muted">
                <ClubMark name={latest.club} slug={latest.clubSlug} size={20} />
                <Link href={`/clubs/${latest.clubSlug}`} className="hover:text-text">{latest.club}</Link>
                <span aria-hidden="true">·</span> {latest.competition} {latest.season}
              </p>
            )}
          </div>
        </div>
        <Credit photo={player.photo} className="w-full sm:order-last" />
        <Link href={`/compare?a=${player.slug}`} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink">Compare {player.name.split(' ').at(-1)} with…</Link>
      </header>

      {!latest ? (
        <EmptyState title="No playing time in covered competitions">We only have lineup data for the 2025/26 Premier League so far.</EmptyState>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Appearances" value={latest.appearances} note={`${latest.starts} starts · ${latest.subAppearances} off the bench`} />
            <Figure label="Minutes" value={fmtInt(latest.minutes)} note={latest.clubMatches ? `${Math.round((latest.minutes / (latest.clubMatches * 90)) * 100)}% of club minutes` : undefined} />
            <Figure label="Goals" value={latest.goals} note={latest.penaltyGoals ? `${latest.penaltyGoals} from penalties` : 'None from penalties'} />
            <Figure label="Goals per 90" value={<Stat value={per90} format={n => n.toFixed(2)} />} note={small ? 'Small sample (under 900 min)' : undefined} />
            <Figure label="Share of club goals" value={latest.clubGoals ? `${Math.round((latest.goals / latest.clubGoals) * 100)}%` : '—'} note={latest.clubGoals ? `of ${latest.club}'s ${latest.clubGoals}` : undefined} />
            <Figure label="Cards" value={`${latest.yellowCards} / ${latest.redCards}`} note="Yellow / red" />
          </dl>
          <p className="mt-3 text-xs text-faint">
            Minutes are derived from lineups and substitutions (90 per full match; stoppage time not counted). {capability('assists').note} {capability('positions').note}
          </p>

          <Card title="Match log" eyebrow={`${latest.competition} ${latest.season}`} className="mt-8">
            <div className="relative -mx-2 overflow-x-auto">
              <table className="tabular w-full min-w-[620px] text-sm">
                <caption className="sr-only">{player.name} match by match, {latest.season}</caption>
                <thead className="text-xs text-faint">
                  <tr className="text-left">
                    <th scope="col" className="px-2 py-2 font-medium">Date</th>
                    <th scope="col" className="px-2 py-2 font-medium">Opponent</th>
                    <th scope="col" className="px-2 py-2 font-medium">Result</th>
                    <th scope="col" className="px-2 py-2 font-medium">Role</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Min</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Goals</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Cards</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(m => (
                    <tr key={m.matchSlug} className={`border-t border-line ${m.minutes === null ? 'text-faint' : ''}`}>
                      <td className="px-2 py-2"><Link href={`/matches/${m.matchSlug}`} className="hover:text-text hover:underline">{fmtDate(m.date)}</Link></td>
                      <td className="px-2 py-2">{m.venue === 'A' ? '@ ' : ''}<Link href={`/clubs/${m.opponentSlug}`} className="hover:underline">{m.opponent}</Link></td>
                      <td className="px-2 py-2"><ResultChip goalsFor={m.goalsFor} goalsAgainst={m.goalsAgainst} /></td>
                      <td className="px-2 py-2 text-muted">
                        {m.minutes === null ? 'Unused sub' : m.role === 'starter' ? (m.minuteOff !== null && m.minuteOff < 90 ? `Started, off ${m.minuteOff}’` : 'Started') : `On ${m.minuteOn}’`}
                      </td>
                      <td className="px-2 py-2 text-right">{m.minutes ?? '—'}</td>
                      <td className="px-2 py-2 text-right">{m.goals ? <>{m.goals}{m.penaltyGoals ? <span className="text-faint"> ({m.penaltyGoals}p)</span> : null}</> : ''}{m.ownGoals ? <span className="text-bad"> {m.ownGoals} og</span> : null}</td>
                      <td className="px-2 py-2 text-right">
                        {m.yellowCards > 0 && <span className="mr-1 inline-block h-3.5 w-2.5 rounded-sm bg-warn align-middle" title="Yellow card"><span className="sr-only">Yellow card</span></span>}
                        {m.redCards > 0 && <span className="inline-block h-3.5 w-2.5 rounded-sm bg-bad align-middle" title="Red card"><span className="sr-only">Red card</span></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {player.seasons.length > 1 && (
            <Card title="All seasons" className="mt-6">
              <ul className="space-y-1 text-sm">
                {player.seasons.map(s => (
                  <li key={s.csId + s.clubSlug} className="flex justify-between gap-4 border-t border-line py-2 first:border-0">
                    <span>{s.competition} {s.season} · {s.club}</span>
                    <span className="tabular text-muted">{s.appearances} apps · {fmtInt(s.minutes)} min · {s.goals} goals</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
