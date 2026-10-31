/**
 * A small trend line from real values. Decorative for sighted users; the
 * accessible name states the start and end, so nothing is conveyed by the
 * line alone.
 */
export default function Sparkline({ values, label, width = 120, height = 36, tone = 'var(--text)' }: {
  values: number[]
  label: string
  width?: number
  height?: number
  tone?: string
}) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 3 - ((v - min) / span) * (height - 6)])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <path d={d} fill="none" stroke={tone} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      <circle cx={lx} cy={ly} r="3.2" fill="var(--bg)" stroke={tone} strokeWidth="1.6" />
    </svg>
  )
}
