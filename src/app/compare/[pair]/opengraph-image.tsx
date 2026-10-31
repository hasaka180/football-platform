import { ImageResponse } from 'next/og'
import { pickSeasons, type SeasonLine } from '@/lib/compare'
import { resolvePair } from '@/lib/compare-data'
import { SITE } from '@/lib/site'

export const alt = 'Player comparison'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Share card: names, sample and headline numbers, in the site's colours. */
export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params
  const players = await resolvePair(pair)
  const picked = players ? pickSeasons(players[0].seasons as SeasonLine[], players[1].seasons as SeasonLine[]) : null

  const column = (name: string, s: SeasonLine | null | undefined, colour: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 40, borderRadius: 28, background: '#131519', border: `4px solid ${colour}` }}>
      <div style={{ fontSize: 52, fontWeight: 700, color: colour }}>{name}</div>
      <div style={{ fontSize: 26, color: '#a1a7b3', marginTop: 8 }}>{s ? `${s.club} · ${s.season}` : 'No data'}</div>
      {s && (
        <div style={{ display: 'flex', gap: 40, marginTop: 36 }}>
          {[['Goals', String(s.goals)], ['Apps', String(s.appearances)], ['Minutes', s.minutes.toLocaleString('en-GB')], ['Per 90', s.minutes ? ((s.goals * 90) / s.minutes).toFixed(2) : '—']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: '#f2f3f5' }}>{v}</div>
              <div style={{ fontSize: 22, color: '#7d8491' }}>{k}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0b0c0e', padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 28, color: '#d6f25a', marginBottom: 32 }}>{SITE.name} · Player comparison</div>
        {players ? (
          <div style={{ display: 'flex', gap: 32, flex: 1 }}>
            {column(players[0].name, picked?.a, '#4ea8ff')}
            {column(players[1].name, picked?.b, '#ff9f43')}
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 48, color: '#f2f3f5' }}>Compare footballers with context</div>
        )}
        <div style={{ display: 'flex', fontSize: 22, color: '#7d8491', marginTop: 28 }}>Minutes derived from lineups. Match data: openfootball (CC0).</div>
      </div>
    ),
    size,
  )
}
