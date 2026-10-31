# SEO

## In place
- Server rendering; the homepage is prerendered.
- Title template, description and Open Graph defaults (`src/app/layout.tsx`).
- `robots.txt` blocks `/admin` and `/api/`; admin carries `noindex`.
- `sitemap.xml` lists only pages that exist.

## Rules (implemented in Phase 2)
- **Index a player page** only if the player has at least 1 appearance in a
  covered competition season.
- **Index a comparison** (`/compare/a-vs-b`) only for curated or popular pairs
  (same competition season, both with at least 900 minutes). Arbitrary pairs
  render with `noindex` and a canonical URL in alphabetical slug order.
- **Never generate pages for data we don't have.** For example, there are no
  "assists" leaderboards.
- Structured data: `SportsTeam`, `Person`, `SportsEvent` and `BreadcrumbList` where accurate.
- Search Console: verify at deployment.
