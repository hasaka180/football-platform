import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import PlayerPicker from '@/components/PlayerPicker'
import { Breadcrumbs } from '@/components/page-bits'
import { Skeleton } from '@/components/ui'
import { canonicalPair } from '@/lib/compare'
import { getPlayer } from '@/lib/data'
import { getSeason, getTopScorers } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Compare players',
  description: 'Compare two footballers side by side, with minutes, starts and per-90 context next to every number.',
  alternates: { canonical: '/compare' },
}

export default function ComparePage({ searchParams }: PageProps<'/compare'>) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }]} />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Compare players</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Pick two players. You&apos;ll see each number with the minutes and starts behind it, so a hot streak isn&apos;t mistaken for a full season.
      </p>
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-28" />}>
          {searchParams.then(async sp => {
            const a = typeof sp.a === 'string' ? await getPlayer(sp.a) : null
            const ctx = a?.seasons[0] ? `${a.seasons[0].club} · ${a.seasons[0].season}` : null
            return <PlayerPicker initialA={a ? { slug: a.slug, name: a.name, context: ctx } : null} />
          })}
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <Popular />
      </Suspense>
    </div>
  )
}

async function Popular() {
  const season = await getSeason('premier-league', '2025-26')
  if (!season) return null
  const top = await getTopScorers(season.id, 6)
  const pairs: [typeof top[number], typeof top[number]][] = []
  for (let i = 0; i < top.length - 1; i += 2) pairs.push([top[i], top[i + 1]])
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">Popular comparisons</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {pairs.map(([x, y]) => (
          <li key={x.playerSlug + y.playerSlug}>
            <Link href={`/compare/${canonicalPair(x.playerSlug, y.playerSlug)}`} className="block rounded-xl border border-line p-4 text-sm hover:border-line-strong hover:bg-surface">
              <span className="font-medium">{x.player}</span> <span className="text-faint">vs</span> <span className="font-medium">{y.player}</span>
              <span className="mt-1 block text-xs text-muted">{season.competition} {season.season}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
