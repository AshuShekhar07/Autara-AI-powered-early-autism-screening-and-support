import React from 'react'
import './Charts.css'

/**
 * ScreeningTrendChart
 *
 * Reusable SVG line chart showing screening scores over time.
 *
 * Props:
 *   data — array of { date: string (ISO or display), score: number (0–100) }
 *
 * TODO: replace with real data from GET /api/screenings once built.
 * The API should return an array of screening results sorted by date ascending.
 * Map each result to { date: result.completedAt, score: result.totalScore }.
 *
 * When `data` is empty or not provided, an honest empty state is shown.
 */
export default function ScreeningTrendChart({ data = [] }) {
  const hasData = Array.isArray(data) && data.length > 0

  return (
    <article className="db-card" aria-label="Screening score trend">
      <div className="db-card__header">
        <div>
          <h2 className="db-card__title">Score Trend</h2>
          <p className="db-card__subtitle">How screening scores have changed over time</p>
        </div>
      </div>
      <div className="db-card__body">
        {hasData ? (
          <TrendChart data={data} />
        ) : (
          <EmptyChart
            title="No trend data yet"
            body="Complete your first screening to see how your child's scores change over time."
          />
        )}
      </div>
    </article>
  )
}

/* ── Empty state ── */
function EmptyChart({ title, body }) {
  return (
    <div className="chart-empty" role="status" aria-label={title}>
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
function TrendChart({ data }) {
  const W = 560
  const H = 180
  const PAD = { top: 16, right: 16, bottom: 28, left: 28 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom

  const minScore = Math.min(...data.map(d => d.score))
  const maxScore = Math.max(...data.map(d => d.score))
  const scoreRange = maxScore - minScore || 1

  function xOf(i) { return PAD.left + (i / (data.length - 1)) * innerW }
  function yOf(s) { return PAD.top  + (1 - (s - minScore) / scoreRange) * innerH }

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.score)}`).join(' ')
  const areaPath = [
    `M ${xOf(0)} ${yOf(data[0].score)}`,
    ...data.map((d, i) => `L ${xOf(i)} ${yOf(d.score)}`),
    `L ${xOf(data.length - 1)} ${PAD.top + innerH}`,
    `L ${xOf(0)} ${PAD.top + innerH}`,
    'Z',
  ].join(' ')

  return (
    <div className="trend-chart__svg-wrap">
      <svg
        className="trend-chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        aria-label="Line chart of screening scores over time"
        role="img"
      >
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2F6F62" stopOpacity=".18"/>
            <stop offset="100%" stopColor="#2F6F62" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path className="trend-area" d={areaPath} />
        <polyline className="trend-line" points={pts} />
        {data.map((d, i) => (
          <circle
            key={i}
            className="trend-dot"
            cx={xOf(i)} cy={yOf(d.score)} r={4}
            aria-label={`${d.date}: score ${d.score}`}
          />
        ))}
        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={`lbl-${i}`}
            className="trend-axis-label"
            x={xOf(i)} y={H - 6}
            textAnchor="middle"
          >
            {d.date}
          </text>
        ))}
      </svg>
    </div>
  )
}
