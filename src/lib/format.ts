// Dates are shown in UTC with the zone named, until user time zones arrive
// (stored values are UTC; rendering in UTC keeps server and client identical).
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export const fmtDate = (isoDate: string) => day.format(new Date(`${isoDate.slice(0, 10)}T12:00:00Z`))
export const fmtDayShort = (isoDate: string) => dayShort.format(new Date(`${isoDate.slice(0, 10)}T12:00:00Z`))
export const fmtTimeUtc = (iso: string | null) => (iso ? `${time.format(new Date(iso))} UTC` : 'Time TBC')
export const fmtInt = (n: number) => n.toLocaleString('en-GB')

/** "45+2'" */
export const fmtMinute = (minute: number, added: number | null) => `${minute}${added ? `+${added}` : ''}’`

/** Today in UTC, for "result pending" checks. Passed in so cached pages stay deterministic. */
export function resultPending(status: string, date: string, today: string): boolean {
  return status === 'scheduled' && date < today
}
