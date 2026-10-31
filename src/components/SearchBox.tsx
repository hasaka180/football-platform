'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { hitHref, type SearchHit } from '@/lib/search'

const KIND_LABEL: Record<SearchHit['kind'], string> = { player: 'Player', club: 'Club', competition: 'Competition' }

/** Global search: an ARIA combobox with arrow-key navigation. */
export default function SearchBox({ autoFocus = false, size = 'md' }: { autoFocus?: boolean; size?: 'md' | 'lg' }) {
  const router = useRouter()
  const id = useId()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return // results for short input are hidden at render time
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setStatus('loading')
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setHits(data.hits)
        setActive(data.hits.length ? 0 : -1)
        setStatus('idle')
      } catch {
        if (!ctrl.signal.aborted) { setHits([]); setStatus('error') }
      }
    }, 160)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function go(hit: SearchHit) {
    setOpen(false)
    router.push(hitHref(hit))
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, visible.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && visible[active]) { e.preventDefault(); go(visible[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const showList = open && q.trim().length >= 2
  const visible = showList ? hits : []
  const big = size === 'lg'
  return (
    <div ref={box} className="relative w-full">
      <label htmlFor={`${id}-input`} className="sr-only">Search players, clubs and competitions</label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Search players, clubs, competitions"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        className={`w-full rounded-xl border border-line-strong bg-surface-2 text-text placeholder:text-faint focus:border-accent focus:outline-none ${big ? 'px-5 py-4 text-base' : 'px-4 py-2.5 text-sm'}`}
      />
      <p className="sr-only" aria-live="polite">
        {showList && status === 'idle' ? `${visible.length} result${visible.length === 1 ? '' : 's'}` : ''}
      </p>
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-line-strong bg-surface p-1 shadow-2xl shadow-black/50">
          {status === 'error' && <li className="px-3 py-2.5 text-sm text-warn">Search is unavailable right now.</li>}
          {status !== 'error' && visible.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">{status === 'loading' ? 'Searching…' : 'No matches'}</li>
          )}
          {visible.map((h, i) => (
            <li
              key={`${h.kind}:${h.slug}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => { e.preventDefault(); go(h) }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${i === active ? 'bg-surface-2' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{h.name}</span>
                {h.context && <span className="block truncate text-xs text-muted">{h.context}</span>}
              </span>
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">{KIND_LABEL[h.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
