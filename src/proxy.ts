import { NextResponse, type NextRequest } from 'next/server'

/**
 * Guards /admin with HTTP Basic auth (user "admin", password ADMIN_PASSWORD).
 * With no password configured, admin is open in development and hidden (404)
 * in production, so a missing secret can never expose it.
 */
export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    return process.env.NODE_ENV === 'production'
      ? new NextResponse('Not found', { status: 404 })
      : NextResponse.next()
  }
  const header = req.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = atob(encoded).split(':')
    if (user === 'admin' && timingSafeEqual(pass ?? '', password)) return NextResponse.next()
  }
  return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="admin"' } })
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export const config = { matcher: ['/admin/:path*'] }
