'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" role="alert">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted">This page couldn&apos;t load its data. It has been logged; please try again in a moment.</p>
      <button onClick={reset} className="mt-8 rounded-xl bg-accent px-5 py-3 font-medium text-accent-ink">Try again</button>
    </div>
  )
}
