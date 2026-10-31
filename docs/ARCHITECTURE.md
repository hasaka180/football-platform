# Architecture

```
openfootball (CC0)   football-data.org (key)        ← sources, never called per visitor
        │                    │
        ▼                    ▼
  providers/openfootball  providers/football-data     ← adapters → normalised N* types
        │                    │  (RequestBudget: 9/min, backoff, circuit breaker, usage counter)
        └─────────┬──────────┘
                  ▼
          ingest/ingest.ts                            ← entity resolution, corrections, derived stats
                  ▼
           PostgreSQL (db/migrations)                 ← Supabase in production, PGlite locally
                  ▼
     lib/queries.ts ('use cache' + tags)              ← cached reads, tag-based revalidation
                  ▼
     Next.js App Router pages / api/search            ← server-rendered, CDN-cacheable
```

## Modules

| Path | Responsibility |
|---|---|
| `src/lib/providers/types.ts` | Provider-independent shapes (`NMatch`, `NEvent`…) and the `Provider` interface |
| `src/lib/providers/openfootball.ts` | Parses football.json; player keys are `name@club` (D-004) |
| `src/lib/providers/football-data.ts` | v4 adapter, disabled without a key; scores stored only once finished |
| `src/lib/providers/budget.ts` | Per-minute budget, retries with backoff, circuit breaker |
| `src/lib/ingest/ingest.ts` | Idempotent upserts, one source per season, corrections log, rebuilds stats and standings |
| `src/lib/stats/derive.ts` | Per-player match lines (minutes per D-003, goals, cards) |
| `src/lib/search.ts` | Trigram search over players, club aliases and competitions |
| `src/lib/capabilities.ts` | Feature capability matrix used by the UI |
| `src/lib/db/*` | `Db` interface; PGlite and postgres.js implementations; migration runner |
| `src/proxy.ts` | Basic auth for `/admin` |

## Data flow rules

- **Centralised ingestion.** `npm run ingest` (later a scheduled job) is the only
  code that calls providers. Pages read the database.
- **Provider formats stop at the adapter.** Everything downstream uses `N*`
  types and internal UUIDs; provider keys live in `provider_entity_mappings`.
- **One source per competition season.** Switching sources is explicit
  (`--switch-source`), deletes and rebuilds the season, and is logged in
  `audit_logs`. Merging two sources needs reconciliation rules first.
- **Corrections.** A re-ingest that changes a tracked field writes
  `data_corrections`, bumps `matches.data_version`, rebuilds derived tables,
  and returns cache tags for the matches, clubs and players it touched.

## Caching

Next.js 16 Cache Components: page queries use `'use cache'`, `cacheLife('hours')`
and tags (`competition:…`, `season:…`, `standings:…`, `scorers:…`). The homepage
is prerendered and revalidates hourly. `/api/search` sets
`s-maxage=300, stale-while-revalidate=3600` for the CDN. Admin is dynamic.

**Not wired yet:** calling `revalidateTag(tag, 'max')` with the tags returned
by ingestion. This needs the scheduled ingestion route (Phase 2), because
revalidation must run inside the deployed app.

## Local database

Without `DATABASE_URL`, each server process loads `.data/snapshot.tar.gz`
(about 12 MB, written by `npm run ingest`) into an in-memory PGlite. Build
workers never share a data directory. The same migrations run on Supabase.

## Live data

Free data is delayed, so there is no WebSocket or polling infrastructure.
Freshness is shown from `source_updated_at` and `retrieved_at`.
