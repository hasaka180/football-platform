/**
 * Name handling for entity resolution. Sources publish names inconsistently
 * ("MOHAMED SALAH", "Federico Chiesa", "Francisco Evanilson de Lima Barbosa"),
 * so matching uses a normalised form and display uses a tidied form.
 */

/** Lower-case, accents stripped, punctuation folded to spaces. For matching only. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Matching form for clubs: sources disagree on suffixes and prefixes
 * ("Liverpool" / "Liverpool FC", "Bournemouth" / "AFC Bournemouth").
 */
export function normalizeClubName(name: string): string {
  return normalizeName(name).replace(/\b(fc|afc|cf)\b/g, " ").replace(/\s+/g, " ").trim()
}

/** URL slug from a name. */
export function slugify(name: string): string {
  return normalizeName(name).replace(/ /g, '-')
}

const PARTICLES = new Set(['de', 'da', 'do', 'dos', 'das', 'van', 'von', 'der', 'den', 'di', 'la', 'le', 'del', 'du', 'ter', 'ten'])

/**
 * Display form. A word written entirely in capitals ("SALAH") is a source
 * convention for the surname, not how the name is spelt, so it becomes title
 * case; anything already in mixed case is left alone ("McNeil", "ter Stegen").
 */
export function displayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (word !== word.toUpperCase() || !/\p{Lu}/u.test(word)) return word
      const lower = word.toLowerCase()
      if (i > 0 && PARTICLES.has(lower)) return lower
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase())
    })
    .join(' ')
}
