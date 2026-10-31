# Security and privacy

## In place
- **Admin:** `/admin` uses HTTP Basic auth (`ADMIN_PASSWORD`) via `src/proxy.ts`.
  It is hidden with a 404 in production when no password is set, and marked noindex.
- **Headers** (`next.config.ts`): CSP, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS, `frame-ancestors 'none'`.
- **SQL:** every query is parameterised (`$1`…). The only interpolated
  identifiers are fixed table names in code.
- **Input:** search terms are normalised and length-limited (2 to 60 characters).
- **Rate limiting:** 60 searches per minute per IP (in-memory, per instance).
- **Secrets:** environment variables only. The football-data.org terms forbid
  keys in open-source repositories, and `.env*` is git-ignored.
- **Provider data:** validated with zod before use. Raw responses are never re-served.
- **No personal data is collected.** There are no accounts, cookies or analytics yet.

## Known trade-offs
- **CSP:** the policy allows `'unsafe-inline'` scripts because Next.js inlines
  hydration data. Nonce-based CSP forces every page to render dynamically,
  which defeats CDN caching. Revisit if third-party scripts are ever added.
- **Basic auth** is a foundation measure. Replace it with Supabase Auth and
  roles in Phase 4.
- **Rate limiting** is per instance; use a shared store if scaled horizontally.

## Reporting
Security issues: contact the owner (Darwin Corp). A security.txt will be added
at deployment.
