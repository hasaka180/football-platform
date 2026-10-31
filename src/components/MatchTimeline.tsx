import type { MatchDetail } from '@/lib/data'

const LABEL: Record<string, string> = {
  goal: 'Goal', penalty_goal: 'Penalty goal', own_goal: 'Own goal', yellow_card: 'Yellow card',
  second_yellow: 'Second yellow', red_card: 'Red card', substitution: 'Substitution',
}

function Mark({ type }: { type: string }) {
  if (type === 'goal' || type === 'penalty_goal' || type === 'own_goal') {
    return <span className="grid size-4 place-items-center rounded-full bg-text text-[9px] text-bg">●</span>
  }
  if (type === 'yellow_card') return <span className="block h-3.5 w-2.5 rounded-[2px] bg-warn" />
  if (type === 'red_card' || type === 'second_yellow') return <span className="block h-3.5 w-2.5 rounded-[2px] bg-bad" />
  return <span className="text-[11px] text-muted">⇄</span>
}

/**
 * Horizontal match timeline: home events above the line, away events below,
 * half-time and full-time markers. Visual summary only; the match page also
 * lists every event as text, and each marker carries its own label.
 */
export default function MatchTimeline({ m, homeLabel, awayLabel }: { m: Pick<MatchDetail, 'events' | 'extraTime'>; homeLabel: string; awayLabel: string }) {
  const end = m.extraTime ? 120 : 90
  const pos = (minute: number, added: number | null) => `${Math.min(100, ((Math.min(minute, end) + (added ? Math.min(added, 5) * 0.15 : 0)) / end) * 100)}%`
  const { events } = m
  return (
    <div className="glass rounded-2xl px-4 py-3" aria-hidden="true">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{homeLabel}</span>
        <div className="relative h-6">
          {events.filter(e => e.side === 'home').map(e => (
            <span key={e.seq} title={`${e.minute}${e.added ? `+${e.added}` : ''}′ ${LABEL[e.type]}: ${e.player ?? ''}`} className="absolute bottom-0 -translate-x-1/2" style={{ left: pos(e.minute, e.added) }}><Mark type={e.type} /></span>
          ))}
        </div>
        <span />
        <div className="relative h-5">
          <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
          {[0, 45, 90, ...(m.extraTime ? [120] : [])].map(t => (
            <span key={t} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-strong bg-bg px-1.5 text-[10px] text-faint" style={{ left: `${(t / end) * 100}%` }}>
              {t === 0 ? 'KO' : t === 45 ? 'HT' : t === end ? 'FT' : `${t}′`}
            </span>
          ))}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{awayLabel}</span>
        <div className="relative h-6">
          {events.filter(e => e.side === 'away').map(e => (
            <span key={e.seq} title={`${e.minute}${e.added ? `+${e.added}` : ''}′ ${LABEL[e.type]}: ${e.player ?? ''}`} className="absolute top-0 -translate-x-1/2" style={{ left: pos(e.minute, e.added) }}><Mark type={e.type} /></span>
          ))}
        </div>
      </div>
    </div>
  )
}
