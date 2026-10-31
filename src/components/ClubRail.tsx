import Link from 'next/link'
import { ClubMark } from '@/components/ui'
import { getSeason, getStandings } from '@/lib/queries'

/** Vertical glass rail of club shortcuts (wide screens), in table order. */
export default async function ClubRail() {
  const season = await getSeason('premier-league', '2025-26')
  if (!season) return null
  const clubs = await getStandings(season.id)
  return (
    <nav aria-label="Clubs" className="glass fixed right-3 top-1/2 z-30 hidden max-h-[80vh] -translate-y-1/2 flex-col items-center gap-2 overflow-y-auto rounded-2xl p-2 xl:flex">
      {clubs.map(c => (
        <Link key={c.clubSlug} href={`/clubs/${c.clubSlug}`} title={c.club} className="rounded-lg p-0.5 opacity-80 transition hover:scale-110 hover:opacity-100">
          <ClubMark name={c.club} slug={c.clubSlug} size={28} />
          <span className="sr-only">{c.club}</span>
        </Link>
      ))}
    </nav>
  )
}
