/**
 * Fixed-window limiter per key (an IP), in memory. Enough to blunt abuse on a
 * single instance; swap for a shared store if traffic ever needs several.
 */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (key: string, now = Date.now()): { ok: boolean; retryAfter: number } => {
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return { ok: true, retryAfter: 0 }
    }
    entry.count++
    return { ok: entry.count <= limit, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
}
