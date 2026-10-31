/** Product identity. The name is a working title (docs/DECISIONS.md D-001). */
export const SITE = {
  name: 'Beyond the Score',
  tagline: 'Understand football beyond the score.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  owner: 'Darwin Corp',
}
