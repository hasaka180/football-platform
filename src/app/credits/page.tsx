import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/page-bits'
import PlayerPhoto, { Credit } from '@/components/PlayerPhoto'
import { getPhotoCredits } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Credits and data sources',
  description: 'Where our data and photos come from, with full attribution for every image.',
  alternates: { canonical: '/credits' },
}

export default async function CreditsPage() {
  const photos = await getPhotoCredits()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Credits', href: '/credits' }]} />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Credits and data sources</h1>

      <section className="mt-8 space-y-2 text-sm text-muted">
        <h2 className="text-lg font-semibold text-text">Data</h2>
        <p>Match data, lineups and events: <a className="underline" href="https://github.com/openfootball" rel="noopener">openfootball</a>, dedicated to the public domain (CC0).</p>
        <p>Football data provided by the Football-Data.org API.</p>
        <p>Player statistics such as minutes and per-90 rates are derived by us from that data; methods are explained next to each figure.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Player photos are from Wikimedia Commons under Creative Commons or public-domain terms, credited to their authors below.
          Club badges are our own designs in each club&apos;s colours; official crests are not used.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {photos.map(p => (
            <li key={p.playerSlug} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
              <PlayerPhoto name={p.player} photo={p} size={56} rounded="rounded-xl" />
              <div className="min-w-0">
                <Link href={`/players/${p.playerSlug}`} className="text-sm font-medium hover:underline">{p.player}</Link>
                <Credit photo={p} className="mt-1" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
