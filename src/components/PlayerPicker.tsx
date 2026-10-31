'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { canonicalPair } from '@/lib/compare'
import type { SearchHit } from '@/lib/search'

type Picked = { slug: string; name: string; context: string | null }

function Field({ label, tone, picked, onPick }: { label: string; tone: 'a' | 'b'; picked: Picked | null; onPick: (p: Picked | null) => void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?kind=player&q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        const data = await res.json()
        setHits(res.ok ? data.hits : [])
        setActive(0)
      } catch { /* aborted */ }
    }, 160)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  const visible = q.trim().length >= 2 ? hits : []
  const ring = tone === 'a' ? 'border-a' : 'border-b'

  if (picked) {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-xl border-2 ${ring} bg-surface px-4 py-3`}>
        <span>
          <span className="block text-xs text-faint">{label}</span>
          <span className="block font-medium">{picked.name}</span>
          {picked.context && <span className="block text-xs text-muted">{picked.context}</span>}
        </span>
        <button type="button" onClick={() => { onPick(null); setQ('') }} className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">Change</button>
      </div>
    )
  }
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs text-faint">{label}</label>
      <input
        id={id} type="search" role="combobox" aria-expanded={visible.length > 0} aria-controls={`${id}-list`}
        aria-activedescendant={visible.length ? `${id}-${active}` : undefined} autoComplete="off"
        placeholder="Search for a player" value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, visible.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
          if (e.key === 'Enter' && visible[active]) { e.preventDefault(); onPick(visible[active]) }
        }}
        className={`w-full rounded-xl border-2 ${ring} bg-surface-2 px-4 py-3 placeholder:text-faint focus:outline-none`}
      />
      {visible.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-2 w-full rounded-xl border border-line-strong bg-surface p-1 shadow-2xl shadow-black/50">
          {visible.map((h, i) => (
            <li key={h.slug} id={`${id}-${i}`} role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); onPick(h) }}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${i === active ? 'bg-surface-2' : ''}`}>
              <span className="font-medium">{h.name}</span>{h.context && <span className="text-muted"> · {h.context}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Two player pickers; navigates to the comparison once both are chosen. */
export default function PlayerPicker({ initialA }: { initialA: Picked | null }) {
  const router = useRouter()
  const [a, setA] = useState<Picked | null>(initialA)
  const [b, setB] = useState<Picked | null>(null)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Player A" tone="a" picked={a} onPick={setA} />
        <Field label="Player B" tone="b" picked={b} onPick={setB} />
      </div>
      <button
        type="button" disabled={!a || !b || a.slug === b.slug}
        onClick={() => a && b && router.push(`/compare/${a.slug}-vs-${b.slug}`)}
        className="rounded-xl bg-accent px-5 py-3 font-medium text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Compare
      </button>
      {a && b && a.slug === b.slug && <p className="text-sm text-warn">Pick two different players.</p>}
      <p className="text-xs text-faint">Canonical link for this pair: {a && b ? `/compare/${canonicalPair(a.slug, b.slug)}` : '—'}</p>
    </div>
  )
}
