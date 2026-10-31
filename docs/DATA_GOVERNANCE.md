# Data governance

## Traceability
Every match row records `source_code`, `retrieved_at` and `data_version`.
Competition seasons record the owning source, when we last ingested, and when
the source itself last changed. Ingestion jobs record start, finish, status,
summary and per-item warnings (`ingestion_failures`).

## Entity resolution
- **Clubs:** matched by normalised name, ignoring FC/AFC/CF, plus curated aliases
  (`src/lib/club-aliases.ts`). This is how the same club joins across sources.
- **Players:** matched only by provider key, never by name alone (D-004).
  openfootball keys are `normalised name@club`, so a transfer creates a second
  record until an explicit mapping links them (admin tooling in Phase 2).
- Unresolved names (an event naming someone not in the lineup) are kept as
  `player_name` with a null `player_id`, logged as warnings, and never guessed.

## Corrections
A re-ingest compares tracked match fields (status, scores, kick-off,
extra time, penalties) and the event list. Each change is written to
`data_corrections` with old and new values. The match's `data_version`
increments, derived stats and standings are rebuilt, and cache tags for the
affected entities are returned.

## Missing data
- **Null is unknown.** The UI shows "—" with a reason, never 0.
- A match without a score stays scheduled with a null score.
- A kick-off time without a UTC offset is stored as a date only.
- Compact score formats are accepted as full-time scores, with a warning per match.

## Validated on real data (2025/26 Premier League)
- Goal events match the published score in all 380 matches.
- Every side has 11 starters.
- Season goal totals equal goal events (1,005), with 40 own goals.
- 20 clubs, each played 38; no player exceeds 3,420 minutes.

## Development data
Synthetic fixtures (fictional clubs and players) live in `tests/fixtures`, are
labelled as such, and ingest under the non-production `dev-fixtures` source,
which pages never read (`data_sources.is_production`).
