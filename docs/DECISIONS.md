# Decisions

Each entry is a decision, the reason, and how to reverse it.

**D-001: Working name "Beyond the Score".** Taken from the positioning line.
It is set in `src/lib/site.ts`, so a rename is a one-line change. Needs
trademark clearance before launch.

**D-002: openfootball is the source of player statistics.** It is the only free
source found with player-level match data (lineups, substitutions, goals, cards)
under a licence (CC0) that clearly allows a commercial public site. The
trade-offs: no assists, positions or IDs, and complete only for finished seasons.

**D-003: Minutes played are derived, and labelled as such.** A starter is
credited from minute 0, a substitute from the minute they come on, until they
are substituted off or sent off, otherwise until minute 90. Stoppage time is
not counted because the source does not record match length, so per-90 figures
use these minutes. The method is shown on every page that uses minutes.

**D-004: Player identity is resolved by normalised name within a club.** A
player is keyed by `(normalised name, club)` per source. A player who moves
club creates a second candidate, merged only through an explicit mapping in
`player_aliases` or `provider_entity_mappings`, never automatically by name
alone. This avoids silently merging two people who share a name.

**D-005: Postgres everywhere, with PGlite for development and tests.** The
same SQL migrations run on Supabase in production and on PGlite (Postgres
compiled to WebAssembly) locally and in CI. No database account is needed to
develop. Reverse by pointing `DATABASE_URL` at any Postgres instance.

**D-006: No analytics or monitoring vendor yet.** These are chosen at
deployment, when the host is known, to avoid creating accounts early.

**D-007: Hand-built UI primitives first; shadcn/ui added when needed.** The
Phase 1 components (cards, badges, freshness, empty and stat states) are small.
shadcn/ui is added when a complex accessible primitive is needed, such as the
search command palette in Phase 2. This keeps dependencies down.

**D-008: Next.js 16 Cache Components.** Data reads use `'use cache'` with
`cacheLife` and tags. Ingestion calls `revalidateTag` for the entities it
touched, so corrections refresh only the affected pages.

**D-010: Entity pages read params directly (`instant = false`); unknown slugs are soft 404s.**
Player, club, match, competition and comparison pages read their route params
before rendering, and every known slug is prerendered. With Cache Components,
`dynamicParams = false` is unavailable, so in production an unknown slug gets
the static shell and the not-found page with **HTTP 200 and
`<meta name="robots" content="noindex">`**. This was verified, including with a
Googlebot user agent. Development returns a real 404. That is acceptable
because nothing links to unknown slugs and the sitemap lists only real pages.
If real 404 status codes become necessary, the option is a slug manifest
checked in `proxy.ts`.

**D-009: Comparison charts are accessible paired bars, not a chart library.**
A metric table with proportional bars (values always in text, bars
`aria-hidden`) covers the MVP's side-by-side comparisons. It avoids shipping
ECharts (about 1 MB) before a chart type actually needs it, such as season
trends in Phase 3.
