import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Card, Skeleton } from '@/components/ui'
import { getDb } from '@/lib/db/client'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

const fmt = (iso: string | null) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—')

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Data operations</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AdminData />
      </Suspense>
    </div>
  )
}

async function AdminData() {
  await connection() // always fresh: this page is for operators
  const db = await getDb()
  const [sources, seasons, jobs, failures, corrections, usage] = await Promise.all([
    db.query<{ code: string; name: string; licence: string; attribution: string | null; is_production: boolean }>(
      `SELECT code, name, licence, attribution, is_production FROM data_sources ORDER BY code`),
    db.query<{ target: string; source_code: string; retrieved_at: string | null; source_updated_at: string | null; matches: number; finished: number }>(
      `SELECT c.slug || '/' || s.slug AS target, cs.source_code, cs.retrieved_at::text, cs.source_updated_at::text,
              (SELECT count(*)::int FROM matches m WHERE m.competition_season_id = cs.id) AS matches,
              (SELECT count(*)::int FROM matches m WHERE m.competition_season_id = cs.id AND m.status = 'finished') AS finished
       FROM competition_seasons cs JOIN competitions c ON c.id = cs.competition_id JOIN seasons s ON s.id = cs.season_id ORDER BY 1`),
    db.query<{ id: string; target: string; source_code: string; status: string; started_at: string; summary: Record<string, number> | null; error: string | null }>(
      `SELECT id, target, source_code, status, started_at::text, summary, error FROM ingestion_jobs ORDER BY started_at DESC LIMIT 15`),
    db.query<{ target: string; reason: string; n: number }>(
      `SELECT j.target, f.reason, count(*)::int AS n FROM ingestion_failures f JOIN ingestion_jobs j ON j.id = f.job_id
       WHERE f.job_id IN (SELECT DISTINCT ON (target) id FROM ingestion_jobs ORDER BY target, started_at DESC)
       GROUP BY 1, 2 ORDER BY n DESC LIMIT 20`),
    db.query<{ field: string; n: number; last: string }>(
      `SELECT field, count(*)::int AS n, max(detected_at)::text AS last FROM data_corrections GROUP BY field ORDER BY n DESC`),
    db.query<{ source_code: string; day: string; requests: number }>(
      `SELECT source_code, day::text, requests FROM api_usage ORDER BY day DESC LIMIT 14`),
  ])

  const th = 'px-2 py-2 text-left text-xs font-medium text-faint'
  const td = 'px-2 py-2 align-top'
  return (
    <>
      <Card title="Providers">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Code</th><th className={th}>Licence</th><th className={th}>Attribution shown</th><th className={th}>Production</th></tr></thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.code} className="border-t border-line">
                <td className={td}>{s.name} <span className="text-faint">({s.code})</span></td>
                <td className={td}>{s.licence}</td>
                <td className={td}>{s.attribution ?? '—'}</td>
                <td className={td}>{s.is_production ? 'Yes' : 'No (tests only)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-faint">football-data.org: {process.env.FOOTBALL_DATA_API_KEY ? 'key configured' : 'no key configured, adapter disabled'}.</p>
      </Card>

      <Card title="Coverage and freshness">
        <table className="tabular w-full text-sm">
          <thead><tr><th className={th}>Competition season</th><th className={th}>Source</th><th className={th}>Matches</th><th className={th}>Source updated</th><th className={th}>Last ingested</th></tr></thead>
          <tbody>
            {seasons.map(s => (
              <tr key={s.target} className="border-t border-line">
                <td className={td}>{s.target}</td><td className={td}>{s.source_code}</td>
                <td className={td}>{s.finished}/{s.matches} played</td>
                <td className={td}>{fmt(s.source_updated_at)}</td><td className={td}>{fmt(s.retrieved_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Recent ingestion jobs">
        <table className="tabular w-full text-sm">
          <thead><tr><th className={th}>Started</th><th className={th}>Target</th><th className={th}>Status</th><th className={th}>Result</th></tr></thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-t border-line">
                <td className={td}>{fmt(j.started_at)}</td><td className={td}>{j.target}</td>
                <td className={`${td} ${j.status === 'failed' ? 'text-bad' : j.status === 'succeeded' ? 'text-good' : ''}`}>{j.status}</td>
                <td className={`${td} text-muted`}>
                  {j.error ?? (j.summary ? `${j.summary.inserted} new · ${j.summary.updated} updated · ${j.summary.corrections} corrections · ${j.summary.warnings} warnings` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Warnings from the latest run">
          {failures.length === 0 ? <p className="text-sm text-muted">None.</p> : (
            <ul className="space-y-2 text-sm">
              {failures.map(f => <li key={f.target + f.reason}><span className="tabular text-faint">{f.n}×</span> {f.reason} <span className="text-faint">({f.target})</span></li>)}
            </ul>
          )}
        </Card>
        <Card title="Corrections and API usage">
          <ul className="space-y-1 text-sm">
            {corrections.length === 0 && <li className="text-muted">No provider corrections recorded.</li>}
            {corrections.map(c => <li key={c.field}>{c.field}: <span className="tabular">{c.n}</span> <span className="text-faint">(last {fmt(c.last)})</span></li>)}
          </ul>
          <ul className="mt-4 space-y-1 text-sm">
            {usage.length === 0 && <li className="text-muted">No metered API requests yet.</li>}
            {usage.map(u => <li key={u.source_code + u.day}>{u.day} · {u.source_code}: <span className="tabular">{u.requests}</span> requests</li>)}
          </ul>
        </Card>
      </div>
    </>
  )
}
