# Free football data providers

Evaluated 31 October 2026 against each provider's own pages where they could be
read. "Not yet verified" means the claim comes from third-party sources only, or
needs an account to confirm. Re-check before launch: free tiers change.

## Summary

| Provider | Cost | PL | UCL | Player-level data | Commercial use on free tier | Verdict |
|---|---|---|---|---|---|---|
| **openfootball** (football.json / champions-league) | Free, no account | ✅ | ✅ (text format) | Lineups, subs with minutes, goals, cards (completed seasons) | ✅ CC0 public domain | **Primary source for player statistics** |
| **football-data.org** | Free forever, account + key, no card | ✅ | ✅ | ❌ (paid "Deep Data" tier) | No prohibition found; attribution required | **Primary source for current fixtures, results, standings** |
| **API-Football** (api-sports) | 100 requests/day free | ✅ | ✅ | ✅ per-player season stats | ⚠️ Not verified; terms grant no rights over competitions | Not used in MVP; candidate paid upgrade |
| **Sportmonks** | Free tier exists, contents unpublished | ❌ (not confirmed) | ❌ | Paid | Not verified | Not used; candidate paid upgrade |
| **StatsBomb open data** | Free, registration | Selected historical comps only | Selected | Event-level | ⚠️ Research use; commercial terms not confirmed | Not used |
| **FBref / Transfermarkt / WhoScored / Sofascore** | n/a | — | — | — | ❌ No API licence; scraping prohibited by their terms | Never used |

## openfootball

- **Source:** `github.com/openfootball/football.json` (generated JSON) and
  `github.com/openfootball/champions-league` (Football.TXT).
- **Licence:** CC0 1.0 (public domain dedication). No attribution required; we credit it anyway.
- **Registration / payment:** none.
- **Premier League 2025/26 (`en.1-full.json`):** all 380 matches, each with
  kick-off date and time, venue, attendance, half-time and full-time score,
  goals (scorer, minute, `penalty`, `owngoal`), lineups (starters, bench,
  captain), substitutions (on, off, minute), bookings (`Y`/`R`, minute) and referees.
- **Premier League 2026/27 (`en.1.json`):** fixtures and scores only. At the time
  of evaluation the file was last updated 22 Sept 2026 (45 of 380 matches
  scored), so it is **not reliable for current results**.
- **Champions League:** 2023/24 to 2025/26 in Football.TXT (`cl.txt`), which needs a parser.
- **Missing:** assists, player positions, player identifiers, nationality, age,
  shots, passes, tackles, xG. Names only, with inconsistent capitalisation
  (`MOHAMED SALAH`, `Federico Chiesa`).
- **Rate limits:** none (static files). Fetch once per update, never per visitor.
- **Caching/storage:** unrestricted (public domain).

## football-data.org

- **Free tier:** 12 competitions including Premier League and UEFA Champions
  League; "Basic data (Fixtures, Results and League Tables)"; 10 calls/minute;
  scores and schedules **delayed**. "Free Plan is Free Forever."
- **Registration:** account with email; API key. No card for the free tier.
- **Terms (effective 1 June 2018):**
  - One key covers a single application on a single domain (2.3).
  - Fair-use policy; excessive use can be cancelled without notice (3.3).
  - Keys must not be stored in open-source repositories (6.1).
  - **Attribution required:** "Football data provided by the Football-Data.org API" in a visible place (7.1).
  - After cancelling, data obtained may no longer be referenced on the site (9.1).
  - Logos and photos are owned by their rights holders; consent is needed to show them (9.2).
- **Commercial use:** the terms contain no prohibition for the free tier. Not
  an explicit grant either. Recommend emailing daniel@football-data.org to
  confirm before monetisation.
- **Not on free tier:** player stats, lineups, squads, goal scorers, bookings.
- **Status in this repo:** adapter implemented against the documented v4 API;
  **disabled until a key is supplied** (`FOOTBALL_DATA_API_KEY`).

## API-Football (api-sports.io)

- Free plan reported at 100 requests/day with all endpoints and recent seasons.
  The site blocks automated reading, so limits are **not yet verified** first-hand.
- The terms place responsibility for data licensing on the customer and grant
  no commercial rights over the competitions.
- 100 requests/day cannot support a public site directly, but could support a
  nightly ingest of a narrow dataset. Revisit when budget exists.

## Sportmonks

- Mentions "a free tier you can start on right now" but publishes no contents.
  Paid plans have a 14-day trial that requires a card. Not used: requires a
  payment method, which breaks the $0 rule.

## Feature capability matrix

Implemented in code at `src/lib/capabilities.ts`. The UI reads it to show or
hide features and to choose honest empty states.

| Feature | Status | Source |
|---|---|---|
| PL fixtures & results 2025/26 | Available | openfootball |
| PL lineups & substitutions 2025/26 | Available | openfootball |
| PL goals, penalties, own goals 2025/26 | Available | openfootball |
| PL cards 2025/26 | Available | openfootball |
| PL standings 2025/26 | Available (computed from results) | openfootball |
| Player appearances, starts, minutes, goals, cards, per-90 (PL 2025/26) | Available (derived) | openfootball |
| Assists | Unavailable | — |
| Player positions, nationality, age | Unavailable | — (paid tiers only) |
| Shots, passes, tackles, interceptions | Unavailable | — |
| xG / xA | Unavailable | — |
| PL fixtures & results 2026/27 (current) | Partially available | openfootball (stale); football-data.org once key added |
| PL standings 2026/27 | Not yet verified | football-data.org (key needed) |
| UCL fixtures & results | Partially available | openfootball text (parser in Phase 2); football-data.org |
| UCL player statistics | Unavailable | — |
| Live match coverage | Unavailable | free data is delayed |
| Transfers | Unavailable | editorial (Phase 3) |
| Player photos, club crests | Licensing blocked | — |
