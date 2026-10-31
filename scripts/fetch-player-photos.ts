/**
 * Finds freely licensed photos for players from Wikidata and Wikimedia Commons.
 *
 *   npm run photos
 *
 * Accuracy first: a photo is used only when the Wikidata person is a member
 * of the player's club during the season AND their name matches, and only if
 * exactly one person matches. Only CC BY, CC BY-SA, CC0 and public-domain
 * files are kept, with author and licence for attribution.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { migrate } from '@/lib/db/migrate'
import { openPglite } from '@/lib/db/pglite'
import { openPostgres } from '@/lib/db/postgres'
import type { Db } from '@/lib/db/types'
import { normalizeName } from '@/lib/names'

loadEnvConfig(process.cwd())

// Wikimedia asks API clients to identify themselves.
const UA = 'BeyondTheScore/0.1 (football statistics; Darwin Corp; hello@thedarwin.co)'
const SNAPSHOT = path.join(process.cwd(), '.data', 'snapshot.tar.gz')
const SEASON_START = '2025-07-01'
const SEASON_END = '2026-06-30'
const ALLOWED_LICENCE = /^(cc[ -]by(-sa)?[ -]\d(\.\d)?|cc0|public domain|pd\b|pd-)/i

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function sparql<T>(query: string): Promise<T[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response
    try {
      res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(60_000),
    })
    } catch (err) {
      // Network drop or timeout: back off and retry.
      console.warn(`  SPARQL network error (${(err as Error).message}); retrying`)
      await sleep(5000 * (attempt + 1))
      continue
    }
    if (res.ok) {
      const json = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }
      return json.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])) as T)
    }
    if (res.status === 429 || res.status >= 500) { await sleep(3000 * (attempt + 1)); continue }
    throw new Error(`SPARQL HTTP ${res.status}`)
  }
  throw new Error('SPARQL failed after retries')
}

/** Club Wikidata IDs: an association football club whose English label or alias is one of the name variants. */
async function clubIds(clubs: { slug: string; name: string }[]): Promise<Map<string, string>> {
  const variants = (n: string) => {
    const base = n.replace(/\s+(FC|AFC)$/i, '').replace(/^AFC\s+/i, '')
    return [n, base, `${base} F.C.`, `${base} A.F.C.`, `A.F.C. ${base}`, `AFC ${base}`, `${base} FC`]
  }
  const values = clubs.flatMap(c => variants(c.name).map(v => `("${v.replace(/"/g, '\\"')}"@en "${c.slug}")`)).join(' ')
  // Several clubs share names (a defunct 1860s Crystal Palace, a different
  // Bournemouth F.C.), so among matches keep the one with the most Wikipedia
  // language editions: the professional club, by a wide margin.
  const rows = await sparql<{ club: string; slug: string; label: string; links: string }>(`
    SELECT DISTINCT ?club ?slug ?clubLabel ?links WHERE {
      VALUES (?label ?slug) { ${values} }
      { ?club rdfs:label ?label } UNION { ?club skos:altLabel ?label }
      ?club wdt:P31/wdt:P279* wd:Q476028 ; wdt:P17 wd:Q145 ; wikibase:sitelinks ?links .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`)
  const best = new Map<string, { id: string; links: number; label: string }>()
  for (const r of rows) {
    const id = r.club.split('/').pop()!
    const links = Number(r.links)
    const cur = best.get(r.slug)
    if (!cur || links > cur.links) best.set(r.slug, { id, links, label: (r as unknown as { clubLabel: string }).clubLabel })
  }
  for (const [slug, b] of best) console.log(`  ${slug} → ${b.id} "${b.label}" (${b.links} language editions)`)
  return new Map([...best].map(([slug, b]) => [slug, b.id]))
}

type Candidate = { person: string; names: Set<string>; image: string }

/** People who were members of the club during the season and have an image. */
async function clubPeople(clubId: string): Promise<Candidate[]> {
  const rows = await sparql<{ p: string; label?: string; alt?: string; img: string }>(`
    SELECT ?p ?label ?alt ?img WHERE {
      ?p p:P54 ?st . ?st ps:P54 wd:${clubId} .
      OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
      FILTER(!BOUND(?start) || ?start <= "${SEASON_END}T00:00:00Z"^^xsd:dateTime)
      FILTER(!BOUND(?end) || ?end >= "${SEASON_START}T00:00:00Z"^^xsd:dateTime)
      ?p wdt:P106 wd:Q937857 ; wdt:P18 ?img .
      OPTIONAL { ?p rdfs:label ?label FILTER(lang(?label) = "en") }
      OPTIONAL { ?p skos:altLabel ?alt FILTER(lang(?alt) = "en") }
    }`)
  const people = new Map<string, Candidate>()
  for (const r of rows) {
    const person = r.p.split('/').pop()!
    const c = people.get(person) ?? { person, names: new Set<string>(), image: decodeURIComponent(r.img.split('/Special:FilePath/').pop()!).replace(/_/g, ' ') }
    for (const n of [r.label, r.alt]) if (n) c.names.add(normalizeName(n))
    people.set(person, c)
  }
  return [...people.values()]
}

type FileInfo = { title: string; pageUrl: string; thumb: string; w: number; h: number; licence: string; licenceUrl: string | null; artist: string }

/** Commons metadata for files: licence and author, plus a 400px thumbnail. */
async function fileInfo(titles: string[]): Promise<Map<string, FileInfo>> {
  const out = new Map<string, FileInfo>()
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).map(t => `File:${t}`)
    const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '400', titles: batch.join('|'),
    })}`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`Commons HTTP ${res.status}`)
    const json = (await res.json()) as {
      query: { normalized?: { from: string; to: string }[]; pages: { title: string; missing?: boolean; imageinfo?: { thumburl: string; thumbwidth: number; thumbheight: number; descriptionurl: string; extmetadata: Record<string, { value: string }> }[] }[] }
    }
    const from = new Map((json.query.normalized ?? []).map(n => [n.to, n.from]))
    for (const p of json.query.pages) {
      const ii = p.imageinfo?.[0]
      if (!ii) continue
      const m = ii.extmetadata
      const strip = (html?: string) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      const title = (from.get(p.title) ?? p.title).replace(/^File:/, '')
      out.set(title, {
        title: p.title, pageUrl: ii.descriptionurl, thumb: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight,
        licence: strip(m.LicenseShortName?.value), licenceUrl: m.LicenseUrl?.value ?? null, artist: strip(m.Artist?.value) || 'Unknown author',
      })
    }
    await sleep(300)
  }
  return out
}

async function main() {
  const url = process.env.DATABASE_URL
  let db: Db
  let dump: (() => Promise<Blob>) | undefined
  if (url) db = openPostgres(url)
  else {
    if (!existsSync(SNAPSHOT)) throw new Error('Run `npm run ingest` first')
    const pg = await openPglite({ snapshot: new Blob([readFileSync(SNAPSHOT)]) })
    db = pg
    dump = pg.dump
  }
  await migrate(db)

  // Players with appearances in a season that has lineups, grouped by club.
  const players = await db.query<{ id: string; name: string; club_slug: string; club_name: string }>(
    `SELECT DISTINCT p.id, p.name, c.slug AS club_slug, c.name AS club_name
     FROM player_season_statistics s JOIN players p ON p.id = s.player_id JOIN clubs c ON c.id = s.club_id
     WHERE s.appearances > 0`,
  )
  const clubs = [...new Map(players.map(p => [p.club_slug, { slug: p.club_slug, name: p.club_name }])).values()]
  console.log(`${players.length} players across ${clubs.length} clubs`)

  const ids = await clubIds(clubs)
  const missingClubs = clubs.filter(c => !ids.has(c.slug)).map(c => c.name)
  console.log(`Wikidata clubs found: ${ids.size}/${clubs.length}${missingClubs.length ? ` (missing: ${missingClubs.join(', ')})` : ''}`)

  const matches: { playerId: string; person: string; image: string }[] = []
  let ambiguous = 0
  for (const club of clubs) {
    const qid = ids.get(club.slug)
    if (!qid) continue
    const people = await clubPeople(qid)
    for (const p of players.filter(x => x.club_slug === club.slug)) {
      const hits = people.filter(c => c.names.has(normalizeName(p.name)))
      if (hits.length === 1) matches.push({ playerId: p.id, person: hits[0].person, image: hits[0].image })
      else if (hits.length > 1) ambiguous++
    }
    await sleep(500)
  }
  console.log(`Name + club matches: ${matches.length} (${ambiguous} ambiguous, skipped)`)

  const info = await fileInfo([...new Set(matches.map(m => m.image))])
  const now = new Date().toISOString()
  let kept = 0
  const rejected: Record<string, number> = {}
  await db.transaction(async tx => {
    for (const m of matches) {
      const f = info.get(m.image)
      if (!f) { rejected['file not found'] = (rejected['file not found'] ?? 0) + 1; continue }
      if (!ALLOWED_LICENCE.test(f.licence)) { rejected[f.licence || 'no licence'] = (rejected[f.licence || 'no licence'] ?? 0) + 1; continue }
      await tx.query(
        `INSERT INTO player_media (player_id, source_code, wikidata_id, file_title, page_url, thumb_url, thumb_width, thumb_height, licence, licence_url, artist, retrieved_at)
         VALUES ($1, 'wikimedia-commons', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (player_id) DO UPDATE SET wikidata_id = EXCLUDED.wikidata_id, file_title = EXCLUDED.file_title, page_url = EXCLUDED.page_url,
           thumb_url = EXCLUDED.thumb_url, thumb_width = EXCLUDED.thumb_width, thumb_height = EXCLUDED.thumb_height, licence = EXCLUDED.licence,
           licence_url = EXCLUDED.licence_url, artist = EXCLUDED.artist, retrieved_at = EXCLUDED.retrieved_at`,
        [m.playerId, m.person, f.title, f.pageUrl, f.thumb, f.w, f.h, f.licence, f.licenceUrl, f.artist.slice(0, 300), now],
      )
      kept++
    }
  })
  console.log(`Photos stored: ${kept}. Rejected by licence: ${JSON.stringify(rejected)}`)

  if (dump) writeFileSync(SNAPSHOT, Buffer.from(await (await dump()).arrayBuffer()))
  await db.close()
}

main().catch(err => { console.error(err); process.exit(1) })
