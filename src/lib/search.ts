import type { Db } from '@/lib/db/types'
import { normalizeName } from '@/lib/names'

export type SearchHit = {
  kind: 'player' | 'club' | 'competition'
  slug: string
  name: string
  /** Secondary line: a player's latest club, a club's country. */
  context: string | null
  score: number
}

export const SEARCH_MIN = 2
export const SEARCH_MAX = 60

/**
 * Typo-tolerant search over players, clubs (with aliases) and competitions,
 * using pg_trgm. Prefix matches on any word rank first, then fuzzy matches.
 */
export async function search(db: Db, raw: string, limit = 8, kind?: SearchHit['kind']): Promise<SearchHit[]> {
  const q = normalizeName(raw).slice(0, SEARCH_MAX)
  if (q.length < SEARCH_MIN) return []
  return db.query<SearchHit>(
    `WITH q AS (SELECT $1::text AS q),
     player_hits AS (
       SELECT DISTINCT ON (p.id) 'player' AS kind, p.slug, p.name,
              (SELECT c.short_name FROM player_club_memberships m JOIN clubs c ON c.id = m.club_id
                WHERE m.player_id = p.id ORDER BY m.last_match_on DESC NULLS LAST LIMIT 1) AS context,
              greatest(similarity(a.normalized, q.q), word_similarity(q.q, a.normalized))
                + CASE WHEN a.normalized LIKE q.q || '%' OR a.normalized LIKE '% ' || q.q || '%' THEN 1 ELSE 0 END AS score
       FROM players p JOIN player_aliases a ON a.player_id = p.id, q
       WHERE (a.normalized % q.q OR q.q <% a.normalized OR a.normalized LIKE '%' || q.q || '%')
         AND EXISTS (SELECT 1 FROM player_club_memberships m WHERE m.player_id = p.id) -- only players with data
       ORDER BY p.id, score DESC
     ),
     club_hits AS (
       SELECT DISTINCT ON (c.id) 'club' AS kind, c.slug, coalesce(c.short_name, c.name) AS name, c.country AS context,
              greatest(similarity(a.normalized, q.q), word_similarity(q.q, a.normalized))
                + CASE WHEN a.normalized LIKE q.q || '%' OR a.normalized LIKE '% ' || q.q || '%' THEN 1 ELSE 0 END
                + 0.2 AS score  -- a club outranks a player of equal match quality
       FROM clubs c JOIN club_aliases a ON a.club_id = c.id, q
       WHERE a.normalized % q.q OR q.q <% a.normalized OR a.normalized LIKE '%' || q.q || '%'
       ORDER BY c.id, score DESC
     ),
     competition_hits AS (
       SELECT 'competition' AS kind, c.slug, c.name, c.country AS context,
              greatest(word_similarity(q.q, lower(c.name)), CASE WHEN lower(c.short_name) = q.q THEN 1 ELSE 0 END)
                + CASE WHEN lower(c.name) LIKE q.q || '%' OR lower(c.name) LIKE '% ' || q.q || '%' THEN 1 ELSE 0 END + 0.3 AS score
       FROM competitions c, q
       WHERE q.q <% lower(c.name) OR lower(c.short_name) = q.q OR lower(c.name) LIKE '%' || q.q || '%'
     )
     SELECT kind, slug, name, context, round(score::numeric, 3)::float AS score
     FROM (SELECT * FROM player_hits UNION ALL SELECT * FROM club_hits UNION ALL SELECT * FROM competition_hits) hits
     WHERE $3::text IS NULL OR kind = $3
     ORDER BY score DESC, name
     LIMIT $2`,
    [q, limit, kind ?? null],
  )
}

export function hitHref(hit: Pick<SearchHit, 'kind' | 'slug'>): string {
  return { player: '/players/', club: '/clubs/', competition: '/competitions/' }[hit.kind] + hit.slug
}
