import Link from 'next/link'
import type { MatchRow } from '@/lib/data'
import { fmtDayShort, fmtTimeUtc } from '@/lib/format'

/** Compact fixture/result rows. A past match without a score says so; it is never shown as 0–0. */
export default function MatchList({ matches, today, highlight }: { matches: MatchRow[]; today: string; highlight?: string }) {
  if (!matches.length) return <p className="text-sm text-muted">No matches.</p>
  return (
    <ul className="text-sm">
      {matches.map(m => {
        const played = m.homeScore !== null && m.awayScore !== null
        const pending = !played && m.status === 'scheduled' && m.date < today
        return (
          <li key={m.slug} className="border-t border-line first:border-0">
            <Link href={`/matches/${m.slug}`} className="grid grid-cols-[5.5rem_1fr_auto_1fr] items-center gap-2 rounded-md px-1 py-2 hover:bg-surface-2">
              <span className="text-xs text-faint">{fmtDayShort(m.date)}</span>
              <span className={`truncate text-right ${highlight === m.homeSlug ? 'font-semibold' : ''}`}>{m.home}</span>
              <span className="tabular min-w-16 text-center">
                {played ? <span className="font-semibold">{m.homeScore}–{m.awayScore}</span>
                  : m.status === 'postponed' ? <span className="text-xs text-warn">PP</span>
                  : m.status === 'cancelled' ? <span className="text-xs text-bad">Off</span>
                  : pending ? <span className="text-xs text-faint" title="Result not yet published by the source">TBC</span>
                  : <span className="text-xs text-muted">{fmtTimeUtc(m.kickoffAt).replace(' UTC', '')}</span>}
              </span>
              <span className={`truncate ${highlight === m.awaySlug ? 'font-semibold' : ''}`}>{m.away}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
