# Beyond the Score (working title)

A football intelligence platform by Darwin Corp: statistics shown with the
context behind them. Built to run at **$0/month** on free, properly licensed data.

> Status: Phase 1 (foundation). Not deployed. See `docs/ROADMAP.md`.

## Quick start

```bash
npm install
npm run ingest   # fetch real data (openfootball, CC0) into .data/snapshot.tar.gz
npm run dev      # http://localhost:3000   (admin: /admin, open in dev)
```

No accounts or keys are needed. Optional settings are in `.env.example`.

## Scripts

| Command | What it does |
|---|---|
| `npm run ingest` | Migrate and ingest configured seasons (local snapshot, or `DATABASE_URL`). Add `-- --switch-source` to move a season to another source. |
| `npm test` | 40 unit and integration tests (fixtures and PGlite; no network) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run build` | Production build (needs the snapshot or `DATABASE_URL`) |

## What's real

- **2025/26 Premier League:** all 380 matches with lineups, substitutions,
  goals and cards, from openfootball (CC0). Player stats and the table are
  derived from these.
- **2026/27 Premier League:** fixtures and scores from openfootball, which can
  lag by weeks. football-data.org takes over once a key is set.
- **Not available:** assists, positions, age and nationality, shots, passes,
  xG, live scores, photos and crests. The site says so instead of showing zeros.

Synthetic test data lives only in `tests/fixtures` and is never shown.

## Docs

| | |
|---|---|
| [PRODUCT](docs/PRODUCT.md) | Positioning, competitive review, personas, metrics, MVP scope, risks |
| [FREE_DATA_PROVIDERS](docs/FREE_DATA_PROVIDERS.md) | Provider evaluation and capability matrix |
| [LICENSING](docs/LICENSING.md) | Data-rights registry, media and trademark rules |
| [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE](docs/DATABASE.md) | System design and schema |
| [DATA_GOVERNANCE](docs/DATA_GOVERNANCE.md) | Identity, corrections, missing data, validation |
| [COST_MODEL](docs/COST_MODEL.md) | Free tiers, scaling assumptions, guardrails |
| [SECURITY](docs/SECURITY.md) · [ACCESSIBILITY](docs/ACCESSIBILITY.md) · [SEO](docs/SEO.md) | Controls and rules |
| [DEPLOYMENT](docs/DEPLOYMENT.md) · [ROADMAP](docs/ROADMAP.md) · [DECISIONS](docs/DECISIONS.md) | Operations and plans |
| [EDITORIAL_POLICY](docs/EDITORIAL_POLICY.md) | Principles for the Journal (Phase 3) |

Match data: openfootball (CC0).
