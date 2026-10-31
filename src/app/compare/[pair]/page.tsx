import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/page-bits'
import PlayerPhoto, { Credit } from '@/components/PlayerPhoto'
import ShareButton from '@/components/ShareButton'
import { ClubMark, EmptyState } from '@/components/ui'
import { canonicalPair, compareLines, METRICS, pickSeasons, SMALL_SAMPLE_MINUTES, UNAVAILABLE_METRICS, type SeasonLine } from '@/lib/compare'
import { curatedPairs, resolvePair } from '@/lib/compare-data'
import { fmtInt } from '@/lib/format'
import { SITE } from '@/lib/site'

export async function generateStaticParams() {
  return (await curatedPairs()).map(pair => ({ pair }))
}

export async function generateMetadata({ params }: PageProps<'/compare/[pair]'>): Promise<Metadata> {
  const { pair } = await params
  const players = await resolvePair(pair)
  if (!players) notFound() // a real 404 status before anything streams
  const [a, b] = players
  const canonical = canonicalPair(a.slug, b.slug)
  const curated = (await curatedPairs()).includes(canonical)
  return {
    title: `${a.name} vs ${b.name}: stats compared`,
    description: `${a.name} and ${b.name} side by side: appearances, minutes, goals, per-90 rates and cards, with sample size shown for every number.`,
    alternates: { canonical: `/compare/${canonical}` },
    robots: curated ? undefined : { index: false, follow: true },
  }
}

const groups = [...new Set(METRICS.map(m => m.group))]

// Blocking on purpose: known slugs are prerendered (generateStaticParams), and an
// unknown slug must return a real 404 status, which streaming would turn into a
// 200 with a not-found body (docs/DECISIONS.md D-010).
export const instant = false

export default async function ComparePairPage({ params }: PageProps<'/compare/[pair]'>) {
  const { pair } = await params
  const players = await resolvePair(pair)
  if (!players) notFound()
  const [pa, pb] = players
  const { a, b, sameSeason } = pickSeasons(pa.seasons as SeasonLine[], pb.seasons as SeasonLine[])
  const canonical = canonicalPair(pa.slug, pb.slug)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: `${pa.name} vs ${pb.name}`, href: `/compare/${canonical}` }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-a">{pa.name}</span> <span className="text-faint">vs</span> <span className="text-b">{pb.name}</span>
        </h1>
        <div className="flex gap-2">
          <ShareButton url={`${SITE.url}/compare/${canonical}`} title={`${pa.name} vs ${pb.name}`} />
          <Link href={`/compare?a=${pa.slug}`} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm hover:bg-surface-2">Change players</Link>
        </div>
      </header>

      {!a || !b ? (
        <div className="mt-8">
          <EmptyState title="Not enough data to compare">
            {!a ? pa.name : pb.name} has no playing time in the competitions we cover (2025/26 Premier League lineups).
          </EmptyState>
        </div>
      ) : (
        <>
          {!sameSeason && (
            <p role="note" className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              These players have no season in common, so each is shown for their latest season. Compare with care.
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {([['a', pa, a], ['b', pb, b]] as const).map(([tone, p, s]) => (
              <section key={tone} aria-label={`${p.name} sample`} className={`rounded-2xl border-2 bg-surface p-4 ${tone === 'a' ? 'border-a/60' : 'border-b/60'}`}>
                <div className="flex items-center gap-4">
                  <PlayerPhoto name={p.name} photo={p.photo} size={72} rounded="rounded-2xl" ring={tone === 'a' ? 'ring-2 ring-a/60' : 'ring-2 ring-b/60'} />
                  <div className="min-w-0">
                    <Link href={`/players/${p.slug}`} className="text-lg font-semibold hover:underline">{p.name}</Link>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                      <ClubMark name={s.club} slug={s.clubSlug} size={18} /> {s.club} · {s.competition} {s.season}
                    </p>
                  </div>
                </div>
                <p className="tabular mt-3 text-sm">
                  {s.appearances} apps ({s.starts} starts) · {fmtInt(s.minutes)} minutes
                </p>
                <Credit photo={p.photo} className="mt-2" />
                {s.minutes < SMALL_SAMPLE_MINUTES && (
                  <p className="mt-2 text-xs text-warn">Small sample: under {SMALL_SAMPLE_MINUTES} minutes, so per-90 rates are unreliable.</p>
                )}
              </section>
            ))}
          </div>

          <div className="mt-8 space-y-8">
            {groups.map(group => (
              <section key={group}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-faint">{group}</h2>
                <table className="tabular w-full text-sm">
                  <caption className="sr-only">{group}: {pa.name} compared with {pb.name}</caption>
                  <thead className="sr-only">
                    <tr><th scope="col">Metric</th><th scope="col">{pa.name}</th><th scope="col">{pb.name}</th></tr>
                  </thead>
                  <tbody>
                    {compareLines(a, b).filter(r => r.metric.group === group).map(r => {
                      const flagA = r.metric.rate && a.minutes < SMALL_SAMPLE_MINUTES
                      const flagB = r.metric.rate && b.minutes < SMALL_SAMPLE_MINUTES
                      return (
                        <tr key={r.metric.key} className="border-t border-line">
                          <th scope="row" className="w-1/3 py-3 pr-2 text-left text-xs font-normal sm:pr-3 sm:text-sm">
                            <details className="group">
                              <summary className="cursor-pointer list-none text-text marker:hidden">
                                {r.metric.label} <span aria-hidden="true" className="text-faint group-open:hidden">ⓘ</span>
                              </summary>
                              <p className="mt-1 text-xs text-muted">{r.metric.definition}</p>
                            </details>
                          </th>
                          <td className="w-1/3 py-3 pr-2">
                            <div className="flex items-center justify-end gap-2">
                              <span className={flagA ? 'text-faint' : 'font-semibold'}>{r.a === null ? '—' : r.metric.format(r.a)}{flagA && <span title="Small sample">*</span>}</span>
                              <span aria-hidden="true" className="h-2 w-12 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-40">
                                <span className="float-right h-full rounded-full bg-a" style={{ width: `${r.barA * 100}%` }} />
                              </span>
                            </div>
                          </td>
                          <td className="w-1/3 py-3 pl-2">
                            <div className="flex items-center gap-2">
                              <span aria-hidden="true" className="h-2 w-12 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-40">
                                <span className="block h-full rounded-full bg-b" style={{ width: `${r.barB * 100}%` }} />
                              </span>
                              <span className={flagB ? 'text-faint' : 'font-semibold'}>{r.b === null ? '—' : r.metric.format(r.b)}{flagB && <span title="Small sample">*</span>}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>

          <p className="mt-4 text-xs text-faint">
            Bars show each value relative to the larger of the two; for minutes per goal, a shorter bar means scoring more often.
            * Rate based on fewer than {SMALL_SAMPLE_MINUTES} minutes. Tap a metric for its definition.
          </p>

          <section className="mt-10 rounded-2xl border border-line p-5">
            <h2 className="font-semibold">Not available</h2>
            <p className="mt-1 text-sm text-muted">
              Our free, licensed data sources don&apos;t publish these, so we don&apos;t estimate them: {UNAVAILABLE_METRICS.join(', ')}.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
