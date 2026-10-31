# Database

PostgreSQL. The schema is in `db/migrations/0001_init.sql`, applied by
`src/lib/db/migrate.ts` (each file once, in a transaction, tracked in
`schema_migrations`).

## Tables (Phase 1)

| Group | Tables |
|---|---|
| Provenance | `data_sources` |
| Competitions | `competitions`, `seasons`, `competition_seasons` (owning source, retrieved and source-updated times) |
| Identity | `clubs`, `club_aliases`, `players`, `player_aliases`, `player_club_memberships`, `provider_entity_mappings` |
| Matches | `matches` (11 statuses; nullable scores), `match_lineups`, `match_events` |
| Derived | `player_match_statistics`, `player_season_statistics`, `standings` (`method` = computed or provider) |
| Operations | `ingestion_jobs`, `ingestion_failures`, `data_corrections`, `api_usage`, `audit_logs` |

## Conventions

- UUID primary keys (`gen_random_uuid()`); slugs are unique and used in URLs.
- **Null means unknown, never zero.** Scores, attendance and kick-off time are
  nullable; `kickoff_on` (date) is always set, `kickoff_at` only when the source
  gives a time with a UTC offset.
- Timestamps are `timestamptz` in UTC.
- Derived tables are rebuilt by ingestion for the affected competition season;
  never edit them by hand.
- Trigram GIN indexes back search (`pg_trgm`).

## Deferred to later phases

These come with the features that use them, as the brief says not to
over-engineer: `users`, `user_favorites`, `saved_comparisons` (Phase 4);
`articles`, `article_sources`, `editorial_revisions`, `transfers`,
`transfer_reports` (Phase 3); `match_statistics` and `team_season_statistics`
(when a source provides team stats).

## Backups

Supabase's free tier includes its own backup policy (check the current terms at
deployment). Everything in this database can be rebuilt from the sources with
`npm run ingest`, except `audit_logs` and `data_corrections`. Export those
before destructive operations.
