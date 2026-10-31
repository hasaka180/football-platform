# Deployment

Not deployed. Deployment needs the owner's accounts and approval (host,
Supabase, domain), per the brief.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Production | Postgres connection (Supabase transaction pooler). Without it, the app uses `.data/snapshot.tar.gz`. |
| `FOOTBALL_DATA_API_KEY` | Optional | Enables the football-data.org adapter (current season, UCL). Never commit it. |
| `ADMIN_PASSWORD` | Production | Enables `/admin` (Basic auth, user `admin`). Unset means admin returns 404. |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical origin for metadata and the sitemap. |

## Steps (when approved)
1. Create a Supabase project (free tier) and set `DATABASE_URL`.
2. `DATABASE_URL=… npm run ingest` to migrate and load data.
3. Deploy to a host whose free tier allows commercial use (see COST_MODEL.md).
4. Schedule ingestion daily (Phase 2 adds a protected cron route).
5. Verify Search Console; add security.txt.

## Rollback
The app is stateless. Redeploy the previous build. To roll back data, use the
corrections log, or rebuild from the sources with `npm run ingest`.
Migrations are forward-only; write a new migration to undo a change.
