import React from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { ChartCard, Tip, BRAND, GRID, AXIS_TEXT, axisProps } from '../charts/shared'
import '../clinical/clinical.css'

const HIDDEN = '<5'
const val = (n) => (n === null || n === undefined ? HIDDEN : n)

function Stat({ label, value, hint }) {
  return (
    <div className="cl-stat" title={value === HIDDEN ? 'Hidden to protect privacy: fewer than 5 records' : undefined}>
      <strong>{value}</strong><span>{label}</span>{hint && <span className="sc-hint">{hint}</span>}
    </div>
  )
}

const TIER_LABELS = { low: 'Lower risk', medium: 'Medium risk', high: 'Higher risk' }

/**
 * Anonymised platform analytics (GET /api/admin/analytics). The server hides every count below 5
 * (shown as "<5"); nothing here identifies a person or a child.
 */
export default function AnalyticsSection() {
  const { data, loading, error, reload } = useApi(() => api.get('/api/admin/analytics'), [])
  const a = data?.analytics
  const state = { loading, error, onRetry: reload }

  const tierData = a && Object.keys(TIER_LABELS).map((k) => ({ label: TIER_LABELS[k], count: a.riskTierDistribution[k] ?? 0, hidden: a.riskTierDistribution[k] === null }))
  const week = (rows) => rows.map((w) => ({ label: formatDate(w.weekStart, { day: 'numeric', month: 'short' }), count: w.count ?? 0, hidden: w.count === null }))

  return (
    <section className="cl-card" aria-labelledby="an-h">
      <div>
        <h2 id="an-h">Anonymised analytics</h2>
        <p className="sc-muted">Aggregate counts only. Any number below 5 is hidden ("{HIDDEN}") so no individual can be identified. Individual children's data is never shown here.</p>
      </div>

      {a && (
        <div className="cl-summary" aria-label="Totals">
          <Stat label="Caregivers" value={val(a.totals.users.caregiver)} />
          <Stat label="Patients" value={val(a.totals.users.patient)} />
          <Stat label="Therapists" value={val(a.totals.users.therapist)} />
          <Stat label="Clinicians" value={val(a.totals.users.clinician)} />
          <Stat label="Children" value={val(a.totals.children)} />
          <Stat label="Screenings" value={val(a.totals.screenings)} />
          <Stat label="Behaviour logs" value={val(a.totals.behaviourLogs)} />
          <Stat label="Median time to review" value={a.medianHoursToReview === null ? HIDDEN : `${a.medianHoursToReview} h`} hint="needs ≥ 5 reviews" />
          <Stat label="Awaiting verification" value={a.verificationQueueSize} hint="exact" />
        </div>
      )}

      <div className="cl-two">
        <ChartCard {...state} title="Screenings by risk tier" subtitle="Final tier after any clinician change"
          empty={!!a && tierData.every((t) => t.count === 0 && t.hidden)} emptyText="Not enough data yet (each group needs at least 5)."
          table={a && { columns: ['Tier', 'Screenings'], rows: tierData.map((t) => [t.label, t.hidden ? HIDDEN : t.count]) }}>
          {a && (
            <div className="bh-chart__plot" role="img" aria-label={`Bar chart of screenings by risk tier. ${tierData.map((t) => `${t.label}: ${t.hidden ? 'hidden, fewer than 5' : t.count}`).join('; ')}`}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tierData} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(47,111,98,.06)' }} content={(p) => <Tip {...p} title={(r) => r.label} lines={(r) => [r.hidden ? 'Hidden: fewer than 5' : `${r.count} screenings`]} />} />
                  <Bar dataKey="count" fill={BRAND} maxBarSize={40} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="count" position="top" fill={AXIS_TEXT} fontSize={11} content={({ x, y, width, index }) => (
                      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={AXIS_TEXT} fontSize="11">{tierData[index].hidden ? HIDDEN : tierData[index].count}</text>
                    )} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <WeeklyLine {...state} title="Screenings per week" rows={a && week(a.screeningsPerWeek)} />
      </div>
      <WeeklyLine {...state} title="Behaviour logs per week" rows={a && week(a.logsPerWeek)} />
    </section>
  )
}

function WeeklyLine({ title, rows, ...state }) {
  return (
    <ChartCard {...state} title={title} subtitle="Last 12 weeks · weeks with fewer than 5 are hidden"
      empty={!!rows && rows.every((r) => r.hidden)} emptyText="Not enough data yet (each week needs at least 5)."
      table={rows && { columns: ['Week starting', 'Count'], rows: rows.map((r) => [r.label, r.hidden ? HIDDEN : r.count]) }}>
      {rows && (
        <div className="bh-chart__plot" role="img" aria-label={`Line chart: ${title}. ${rows.filter((r) => !r.hidden).map((r) => `${r.label}: ${r.count}`).join('; ')}`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rows.map((r) => ({ ...r, count: r.hidden ? null : r.count }))} margin={{ top: 12, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" interval="preserveStartEnd" {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
              <Tooltip cursor={{ stroke: GRID }} content={(p) => <Tip {...p} title={(r) => `Week of ${r.label}`} lines={(r) => [r.count === null ? 'Hidden: fewer than 5' : `${r.count}`]} />} />
              <Line type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2} connectNulls={false} dot={{ r: 4, fill: BRAND, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
