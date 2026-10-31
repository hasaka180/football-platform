# Cost model

The budget is $0 per month. Figures below are planning assumptions, not quotes.
Free-tier terms change, so verify each before relying on it (marked ⚠).

## Today

| Item | Cost | Notes |
|---|---|---|
| Sports data | $0 | openfootball (static files), football-data.org free tier (key optional) |
| Database | $0 | PGlite snapshot locally; Supabase free tier when deployed ⚠ |
| Hosting | $0 target | ⚠ Choose a host whose free tier allows commercial use. Vercel's Hobby plan is for non-commercial use, so it fits only while the project earns nothing. Check Cloudflare and Netlify terms at deployment. |
| CI | $0 | GitHub Actions free minutes for public or small private repos ⚠ |
| Monitoring/analytics | $0 | Not chosen yet (D-006) |

## How usage scales

Visitors never trigger provider calls, so the sports API cost stays at 0 at any
traffic level. Ingestion uses about 1 openfootball fetch, plus up to 3
football-data.org calls (under the 10/minute limit), per run.

Page views cost bandwidth and compute:
- **Homepage:** prerendered and CDN-cached (about 1 render per hour).
- **Search:** CDN-cached for 5 minutes per query.

| Monthly active users | Page views (×8) | Searches (×3) | Expected tier |
|---|---|---|---|
| 1,000 | 8k | 3k | Free tiers comfortably |
| 10,000 | 80k | 30k | Free tiers; watch database egress |
| 100,000 | 800k | 300k | Likely exceeds free database egress and compute; first paid step (~$25/month database, ~$20/month host) ⚠ |
| 1,000,000 | 8M | 3M | Paid tiers plus a CDN-heavy setup; estimate after measuring real cache-hit ratios |

**Assumptions:** 8 page views and 3 searches per user per month, an 80% CDN
hit rate, and roughly 30 KB of database egress per uncached page.

**Lever before paying:** the read-only snapshot. The whole 2025/26 season is a
12 MB file, and serving reads from a bundled snapshot instead of a network
database removes database egress entirely. That trades memory per instance
(about 50 MB) for $0 database cost.

## Guardrails

- No paid upgrade or usage-based billing is enabled without explicit approval.
- `api_usage` counts every metered request per day (shown in admin).
- The football-data.org budget stays one request under the published limit and
  stops after repeated failures (circuit breaker).
