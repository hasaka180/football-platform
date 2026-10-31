# Data rights registry

Every dataset we store or display is listed here. Code that ingests a dataset
must reference its `data_sources.code`, which matches the **Code** column.

| Code | Provider | Dataset | Permitted use | Retention | Attribution | Redistribution | Expiry |
|---|---|---|---|---|---|---|---|
| `openfootball` | openfootball | football.json, champions-league | Any, including commercial (CC0 1.0) | Unlimited | Not required; we credit "Match data: openfootball (CC0)" | Permitted | None |
| `football-data` | football-data.org | v4 API, free tier | Display in one application on one domain; no explicit commercial grant (confirm before monetising) | While subscribed; must stop referencing after cancellation (T&C 9.1) | **Required:** "Football data provided by the Football-Data.org API" | Not granted; never expose raw responses through a public API | Ends with the subscription |
| `dev-fixtures` | Darwin Corp | Synthetic test fixtures in `tests/fixtures` | Tests and local development only | n/a | n/a | Never shown in production | n/a |

## Media

No player photographs, club crests, league logos, broadcast footage or match
screenshots are used. Clubs are shown with neutral generated identifiers
(initials and a colour derived from the club ID). football-data.org's terms
(9.2) confirm that crests in its responses are third-party property, so crest
URLs from the API are ignored.

## Trademarks

Competition and club names are used descriptively (nominative use). The product
name is a working title and needs trademark clearance before launch (see
DECISIONS.md, D-001).

## Rules

1. Derived statistics inherit the licence of their inputs. Stats derived only
   from `openfootball` are public domain. Stats derived from `football-data`
   follow its terms.
2. Raw provider payloads are not exposed through any public endpoint.
3. Mock and fixture data is confined to `tests/` and the `dev-fixtures` source,
   and is rejected by the production ingestion path.

## Player photos (added Phase 2)

| Code | Provider | Dataset | Permitted use | Attribution | Notes |
|---|---|---|---|---|---|
| `wikimedia-commons` | Wikimedia Commons, via Wikidata | Player photos (`player_media`) | Commercial use allowed under each file's licence | **Required per file:** author, licence and link, shown next to every photo and on `/credits` | Only CC BY, CC BY-SA, CC0 and public domain are accepted (`npm run photos`). The current mix is 165 CC BY-SA 4.0, 51 CC0, 14 public domain and other CC BY / BY-SA versions; NC and ND licences are never stored. |

**Matching.** A photo is used only when the Wikidata person was a member of the
player's club during the season, their name matches, and exactly one person
matches. Club items are disambiguated by the number of Wikipedia language
editions, which excluded a defunct 1861 Crystal Palace and a different
Bournemouth F.C. Coverage is 309 of 551 players (56%); the rest show initials.

**Share-alike.** CC BY-SA applies to the photo itself; the site is not a
derivative work of it, so the site's own content is unaffected.

**Incidental marks.** Some photos show club crests on shirts. That is
incidental to a licensed photo, not use of the crest as our branding.

## Club badges

Our own shield design in each club's traditional colours with its three-letter
code (`src/lib/club-colours.ts`). Colours and abbreviations are facts, so no
official crest artwork is used. A club without curated colours gets a neutral
shield.
