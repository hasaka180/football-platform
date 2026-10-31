import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">It may not exist yet, or the link may be wrong. Try searching for a player or club instead.</p>
      <Link href="/" className="mt-8 inline-block rounded-xl bg-accent px-5 py-3 font-medium text-accent-ink">Back to home</Link>
    </div>
  )
}
