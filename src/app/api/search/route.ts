import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db/client'
import { rateLimiter } from '@/lib/rate-limit'
import { search, SEARCH_MAX, SEARCH_MIN } from '@/lib/search'

const limit = rateLimiter(60, 60_000) // 60 searches per minute per IP

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = limit(ip)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many searches. Try again shortly.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < SEARCH_MIN || q.length > SEARCH_MAX) return NextResponse.json({ hits: [] })

  try {
    const kindParam = req.nextUrl.searchParams.get('kind')
    const kind = kindParam === 'player' || kindParam === 'club' || kindParam === 'competition' ? kindParam : undefined
    const hits = await search(await getDb(), q, 8, kind)
    return NextResponse.json({ hits }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
  } catch (err) {
    console.error('search failed', err)
    return NextResponse.json({ error: 'Search is unavailable right now.' }, { status: 503 })
  }
}
