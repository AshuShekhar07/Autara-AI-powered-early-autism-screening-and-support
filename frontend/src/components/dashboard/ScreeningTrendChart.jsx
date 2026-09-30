import React from 'react'
import './Charts.css'

/**
 * ScreeningTrendChart
 *
 * SVG line chart of the M-CHAT-R score (number of flagged answers, 0–20) across screenings.
 * The y-axis is always 0–20 with the official tier boundaries marked (3 = medium, 8 = high),
 * so the line is never stretched to look more dramatic than it is.
 *
 * Props: data — [{ date: ISO string, score: 0–20, tier }] ascending by date; loading; error
 */
export default function ScreeningTrendChart({ data = [], loading = false, error = '' }) {
  const hasData = Array.isArray(data) && data.length > 0

  return (
    <article className="db-card" aria-label="Screening score trend">
      <div className="db-card__header">
        <div>
          <h2 className="db-card__title">Score Trend</h2>
          <p className="db-card__subtitle">Flagged answers per screening (0–20). Lower is fewer flags.</p>
        </div>
      </div>
      <div className="db-card__body">
        {loading ? (
          <div className="chart-empty" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
        ) : error ? (
          <EmptyChart title="Couldn't load this chart" body={error} role="alert" />
        ) : hasData ? (
          <TrendChart data={data} />
        ) : (
          <EmptyChart
            title="No trend data yet"
            body="After your first screening, you'll see how the number of flagged answers changes over time."
          />
        )}
      </div>
    </article>
  )
}

/* ── Empty state ── */
function EmptyChart({ title, body, role = 'status' }) {
  return (
    <div className="chart-empty" role={role} aria-label={title}>
      <div className="chart-empty__icon" aria-hidden="true">
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
      <p className="chart-empty__title">{title}</p>
      <p className="chart-empty__body">{body}</p>
    </div>
  )
}

/* ── SVG trend line (used when data exists) ── */
const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function TrendChart({ data }) {
  const W = 560
  const H = 200
  const PAD = { top: 16, right: 40, bottom: 30, left: 28 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom
  const MAX = 20

  const xOf = (i) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yOf = (s) => PAD.top + (1 - s / MAX) * innerH

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.score)}`).join(' ')
  const summary = data.map((d) => `${fmt(d.date)}: ${d.score} flagged`).join('; ')

  return (
    <div className="trend-chart__svg-wrap">
      <svg className="trend-chart__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart of flagged answers per screening. ${summary}`}>
        {/* tier boundaries */}
        {[[3, 'Medium ≥3'], [8, 'High ≥8']].map(([v, label]) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke="#E0E6DE" strokeWidth="1" />
            <text className="trend-axis-label" x={W - PAD.right + 4} y={yOf(v) + 3}>{label}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={yOf(0)} y2={yOf(0)} stroke="#CDD6CB" strokeWidth="1" />
        {data.length > 1 && <polyline className="trend-line" points={pts} />}
        {data.map((d, i) => (
          <g key={d.id || i}>
            <circle className="trend-dot" cx={xOf(i)} cy={yOf(d.score)} r={5}>
              <title>{`${fmt(d.date)}: ${d.score} of 20 answers flagged`}</title>
            </circle>
            <text className="trend-axis-label" x={xOf(i)} y={yOf(d.score) - 10} textAnchor="middle">{d.score}</text>
            <text className="trend-axis-label" x={xOf(i)} y={H - 8} textAnchor="middle">{fmt(d.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
