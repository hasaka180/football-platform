import Link from 'next/link'
import { SITE } from '@/lib/site'

export type Crumb = { label: string; href: string }

/** Breadcrumb trail plus its BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: `${SITE.url}${c.href}` })),
  }
  return (
    <>
      <JsonLd data={data} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-faint">
        <ol className="flex flex-wrap gap-x-2">
          {items.map((c, i) => (
            <li key={c.href} className="flex gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === items.length - 1 ? <span aria-current="page" className="text-muted">{c.label}</span> : <Link href={c.href} className="hover:text-text">{c.label}</Link>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}

/** JSON-LD script; `<` is escaped so data can never close the tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

/** Small labelled figure for stat strips. */
export function Figure({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-muted">{note}</dd>}
    </div>
  )
}

/** Result chip for a match from one club's point of view. */
export function ResultChip({ goalsFor, goalsAgainst }: { goalsFor: number | null; goalsAgainst: number | null }) {
  if (goalsFor === null || goalsAgainst === null) return <span className="text-faint">—</span>
  const r = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'
  const cls = r === 'W' ? 'bg-good/15 text-good' : r === 'L' ? 'bg-bad/15 text-bad' : 'bg-surface-2 text-muted'
  const word = r === 'W' ? 'Won' : r === 'L' ? 'Lost' : 'Drew'
  return (
    <span className={`tabular inline-flex min-w-14 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      <span aria-hidden="true">{r}</span><span className="sr-only">{word}</span> {goalsFor}–{goalsAgainst}
    </span>
  )
}
