# Roadmap

## Phase 0: Feasibility ✅
Provider evaluation, licensing registry, capability matrix, product scope,
personas, risk register, architecture, database design, cost model, decisions.

## Phase 1: Foundation ✅ (this batch)
- Next.js 16 app, design tokens and base components
- PostgreSQL schema and migrations (PGlite locally)
- Provider adapter interface, openfootball and football-data.org adapters, quota protection
- Idempotent ingestion with corrections, derived player stats and standings
- Real 2025/26 Premier League data: 380 matches, 551 players
- Homepage, global search, admin, 404 and error pages, robots, sitemap, security headers
- 40 automated tests; CI workflow

## Phase 2: Functional MVP (in progress)
Done:
- Player pages: season figures with club context, match log, minutes method
- **Comparison engine** (`/compare`, `/compare/[a]-vs-[b]`): 14 metrics with
  definitions, small-sample flags, paired bars, unavailable-metric notice,
  canonical pair URLs, share button, Open Graph share image; 45 curated pairs
  prerendered and indexed, all others noindex
- Club pages (per season: position, record, results, squad stats), competition
  and season pages (table, scorers, results, fixtures, all rounds), match pages
  (score, lineups with minutes, timeline, venue, attendance, referee)
- Structured data (Person, SportsTeam, SportsEvent, BreadcrumbList), header
  navigation, a sitemap of 1,004 indexable URLs

Remaining:
1. Champions League via the football-data.org key and/or an openfootball text parser
2. Scheduled ingestion route plus `revalidateTag` for touched entities
3. Accessibility audit (axe) and a visual pass in browsers
4. Admin tooling to link a player across clubs (transfers)

## Phase 3: Trust and content
Journal, editorial policy and workflow, confirmed transfer tracker, corrections page.

## Phase 4: Engagement
Auth (Supabase), favourites, saved comparisons, shareable graphics.

## Phase 5: Expansion
Paid data (API-Football or Sportmonks), advanced metrics, more competitions,
AI analyst, multilingual.

## Needs the owner
- football-data.org free API key (registration in the owner's name)
- Choice of host and Supabase project when it is time to deploy
- Trademark clearance for the product name
- GitHub repository for CI
