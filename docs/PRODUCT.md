# Product

**Working name:** Beyond the Score (needs trademark clearance; see DECISIONS.md D-001)
**Positioning:** Understand football beyond the score.
**Flagship:** context-aware player comparisons. Each comparison shows not just
the numbers but the minutes, starts and sample size behind them.

## Competitive analysis (desk review)

This is based on published product knowledge, not moderated user testing.
Revisit with real sessions before Phase 4.

| Product | Strength | Gap we can own |
|---|---|---|
| FotMob | Fast live scores, clean mobile UX | Comparisons are shallow; little explanation of context |
| Sofascore | Dense live stats, player ratings | Proprietary ratings are opaque; heavy, ad-dense pages |
| FBref | Deepest free stats, per-90 everywhere | Dated, table-only UX; hard for casual fans; weak sharing |
| Transfermarkt | Market values, transfer histories, huge SEO footprint | Values are opinion presented as data; cluttered |
| WhoScored | Match ratings, heatmaps | Ratings are a black box; ad-heavy |
| Official league sites | Authoritative, licensed media | Single competition; little cross-competition analysis |

**Opportunity:** a calm, fast, transparent comparison experience. It shows the
sample (minutes, starts, games) next to every number, says plainly what isn't
known, and produces shareable visuals. Nobody combines FBref's honesty about
context with FotMob's usability.

## Personas

1. **The arguer** (core). Settles "who's better" debates in group chats.
   Needs: fast search, a fair comparison, a shareable image. Success: shares a comparison.
2. **The fantasy manager.** Weekly research on form and minutes.
   Needs: minutes, starts and per-90 numbers, recent matches. Success: returns weekly.
3. **The creator or journalist.** Needs citable numbers with sources and
   definitions. Success: links to or embeds our pages.
4. **The casual researcher.** Arrives from Google ("Saka vs Palmer stats").
   Needs a clear answer above the fold. Success: a second page view.

## Metrics

**North star:** weekly returning users who complete a meaningful action
(a comparison, a match-analysis view, a share, or a save).

Supporting metrics are listed in the brief. No targets are set until a
baseline exists (first 4 weeks after launch). Instrumentation: Google Search
Console plus a privacy-conscious analytics tool, chosen at deployment (D-006).

## MVP scope

What can be built at $0 (see FREE_DATA_PROVIDERS.md):

| P0 feature | Data | Status |
|---|---|---|
| Player profiles (PL 2025/26) | openfootball | Feasible: appearances, starts, minutes, goals, cards, recent matches. No age, nationality or position. |
| Player comparison engine | openfootball | Feasible with appearance, minutes, goal, card and per-90 metrics. Assists, shots and xG are shown as unavailable. |
| Club profiles | openfootball | Feasible: squad as used in matches, results, record, standings position. |
| Competition pages | openfootball (+ football-data.org) | PL feasible; UCL fixtures and results after the TXT parser or key. |
| Fixtures and results (current season) | football-data.org | Needs the free key. |
| Standings | computed / football-data.org | 2025/26 computed now; current season needs the key. |
| Match detail | openfootball | 2025/26: lineups, subs, goals, cards, venue, attendance, referee. |
| Search | Postgres FTS + trigram | Feasible. |

The comparison engine runs on the **completed 2025/26 Premier League season**
first, because that is where free, licensed player-level data is complete.
Current-season player stats need either openfootball to publish 2026/27 lineups
or a paid source.

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Free sources stop updating or change terms | Medium | High | Provider adapters; data-rights registry; record retrieval dates; show freshness |
| R2 | Player-level data limited to completed seasons | High | High | Lead with "season in review" comparisons; adapter ready for paid data |
| R3 | Name-only player identity causes merges or splits | High | Medium | Name normalisation plus club and season scoping; aliases table; manual mapping in admin |
| R4 | football-data.org commercial use not explicitly granted | Medium | Medium | Email to confirm before monetising; can run on openfootball alone |
| R5 | Thin programmatic pages hurt SEO | Medium | High | Index only pages with minimum data thresholds; noindex arbitrary comparisons |
| R6 | Free hosting tier forbids commercial use | Medium | Medium | Evaluate at deployment (D-005); app is host-agnostic |
| R7 | Trademark conflict with the working name | Unknown | Medium | Clearance before launch |
| R8 | Approximate minutes misread as exact | Medium | Medium | Label the method; definitions next to every metric |
