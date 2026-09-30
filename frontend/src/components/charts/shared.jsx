import React, { useState } from 'react'
import '../behaviour/behaviour.css'

/* Chart palette: single series → one brand hue; grid/axes recessive; text stays in ink tokens. */
export const BRAND = '#2F6F62'
export const GRID = '#E0E6DE'
export const AXIS_TEXT = '#4E5A57'

export const axisProps = { tick: { fill: AXIS_TEXT, fontSize: 11 }, tickLine: false, axisLine: { stroke: GRID } }

/** Tooltip card (text uses ink tokens; a colored dot carries identity). */
export function Tip({ active, payload, title, lines }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="bh-tip" role="status">
      <strong>{title(row)}</strong>
      {lines(row).map((l) => <span key={l}>{l}</span>)}
    </div>
  )
}

/**
 * Card with the three states every chart needs (loading / error / empty) and a
 * "View as table" switch so no information is locked inside the graphic.
 */
export function ChartCard({ title, subtitle, loading, error, onRetry, empty, emptyText, table, children }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <article className="bh-card bh-chart" aria-label={title}>
      <header className="bh-chart__head">
        <div>
          <h3 className="bh-h3">{title}</h3>
          {subtitle && <p className="bh-muted">{subtitle}</p>}
        </div>
        {!loading && !error && !empty && table && (
          <button type="button" className="sc-link-btn" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? 'View chart' : 'View as table'}
          </button>
        )}
      </header>
      {loading ? (
        <div className="bh-chart__state" role="status" aria-busy="true"><div className="spinner spinner--brand" /><span className="bh-muted">Loading…</span></div>
      ) : error ? (
        <div className="bh-chart__state" role="alert">
          <p>Couldn't load this chart.</p><p className="bh-muted">{error}</p>
          <button type="button" className="btn btn--ghost" onClick={onRetry}>Try again</button>
        </div>
      ) : empty ? (
        <div className="bh-chart__state" role="status"><p className="bh-empty">{emptyText}</p></div>
      ) : asTable && table ? (
        <div className="bh-tablewrap">
          <table className="bh-table">
            <thead><tr>{table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j}>{v}</td>))}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </article>
  )
}

