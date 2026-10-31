import Link from 'next/link'
import type { ReactNode } from 'react'
import { CLUB_IDENTITY } from '@/lib/club-colours'

/** A titled panel. */
export function Card({ title, eyebrow, action, children, className = '' }: {
  title: ReactNode
  eyebrow?: ReactNode
  action?: { href: string; label: string }
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-faint">{eyebrow}</p>}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {action && <Link href={action.href} className="shrink-0 text-sm text-muted underline-offset-4 hover:text-text hover:underline">{action.label} →</Link>}
      </header>
      {children}
    </section>
  )
}

/**
 * A statistic that distinguishes "0" from "not available". `null` means we
 * don't have the number, and says so, rather than showing a misleading zero.
 */
export function Stat({ value, label, missing = 'Not available', format }: {
  value: number | null | undefined
  label?: string
  missing?: string
  format?: (n: number) => string
}) {
  if (value === null || value === undefined) {
    return <span className="text-faint" title={missing}>—<span className="sr-only"> {missing}</span></span>
  }
  return <span className="tabular" aria-label={label ? `${label}: ${value}` : undefined}>{format ? format(value) : value}</span>
}

const fmtDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * When the data was last refreshed, and from where. Turns into a warning when
 * the source itself hasn't changed for longer than `staleAfterDays`.
 */
export function Freshness({ source, retrievedAt, sourceUpdatedAt, staleAfterDays }: {
  source: string
  retrievedAt: string | null
  sourceUpdatedAt: string | null
  staleAfterDays?: number
}) {
  const updated = sourceUpdatedAt ?? retrievedAt
  const ageDays = updated ? (Date.parse(retrievedAt ?? updated) - Date.parse(updated)) / 86_400_000 : null
  const stale = staleAfterDays !== undefined && ageDays !== null && ageDays > staleAfterDays
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs ${stale ? 'text-warn' : 'text-faint'}`}>
      <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${stale ? 'bg-warn' : 'bg-good'}`} />
      {updated ? <>Source updated {fmtDate.format(new Date(updated))} (UTC)</> : <>Update time unknown</>}
      <span aria-hidden="true">·</span>
      <span>{source}</span>
      {stale && <span>· May be out of date</span>}
    </p>
  )
}

const MARK_COLOURS = ['#2f6f5e', '#3d5a99', '#7a4b8c', '#8a5a2b', '#2b6f8a', '#8a3b4a', '#5a6b2f', '#4a4f8a']

/**
 * Club badge: an original shield in the club's real colours with its
 * three-letter code. Official crests are trademarks and copyrighted artwork,
 * so they are never used (docs/LICENSING.md). Clubs without curated colours
 * get a neutral shield with initials.
 */
export function ClubMark({ name, slug, size = 28 }: { name: string; slug: string; size?: number }) {
  const id = CLUB_IDENTITY[slug]
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const words = name.replace(/&/g, ' ').split(/\s+/).filter(w => /^[A-Z]/.test(w))
  const code = id?.code ?? (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
  const bg = id?.bg ?? MARK_COLOURS[h % MARK_COLOURS.length]
  const fg = id?.fg ?? '#FFFFFF'
  const accent = id?.accent ?? 'rgba(255,255,255,0.35)'
  const clip = `club-${slug}`
  return (
    <svg aria-hidden="true" width={size} height={size * 1.12} viewBox="0 0 40 45" className="inline-block shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
      <defs>
        <clipPath id={clip}><path d="M20 1.5 37 6.5v15.2c0 10.4-7 17.6-17 21.8C10 39.3 3 32.1 3 21.7V6.5Z" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="40" height="45" fill={bg} />
        <path d="M24 45 44 25v20Z" fill={accent} opacity="0.9" />
      </g>
      <path d="M20 1.5 37 6.5v15.2c0 10.4-7 17.6-17 21.8C10 39.3 3 32.1 3 21.7V6.5Z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <text x="20" y="25.5" textAnchor="middle" fontSize={code.length > 2 ? 11.5 : 14} fontWeight="700" fill={fg} fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="0.3">{code}</text>
    </svg>
  )
}

/** Honest empty or unavailable state. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong p-5 text-sm">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-2 ${className}`} />
}
