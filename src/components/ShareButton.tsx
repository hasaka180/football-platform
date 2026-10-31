'use client'

import { useState } from 'react'

/** Native share sheet where available, otherwise copy the link. */
export default function ShareButton({ url, title }: { url: string; title: string }) {
  const [done, setDone] = useState(false)
  async function share() {
    try {
      if (navigator.share) await navigator.share({ url, title })
      else { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000) }
    } catch { /* cancelled */ }
  }
  return (
    <button type="button" onClick={share} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm hover:bg-surface-2">
      {done ? 'Link copied' : 'Share'}
      <span className="sr-only" aria-live="polite">{done ? 'Link copied to clipboard' : ''}</span>
    </button>
  )
}
