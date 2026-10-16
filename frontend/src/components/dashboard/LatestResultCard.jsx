import React from 'react'
import { Link } from 'react-router-dom'
import { DISCLAIMER, TIER_COPY, STATUS_LABELS } from '../../lib/screeningCopy'
import { formatDate } from '../../lib/format'
import './Charts.css'

/** Latest screening result + open actions. Props: overview, loading */
export default function LatestResultCard({ overview, loading }) {
  const last = overview?.lastScreening
  const copy = last && TIER_COPY[last.effectiveRiskTier]
  return (
    <div className="db-charts-row">
      <article className="db-card" aria-label="Latest result">
        <div className="db-card__header"><h2 className="db-card__title">Latest result</h2></div>
        <div className="db-card__body">
          {loading ? <div className="chart-empty" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
          : !last ? (
            <div className="chart-empty" role="status">
              <p className="chart-empty__title">No screening yet</p>
              <p className="chart-empty__body">The M-CHAT-R takes about 5 minutes.</p>
              <Link to="/screening" className="btn btn--ghost">Start a screening</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontFamily: 'var(--font-head)', fontSize: '1.15rem' }}>{copy.headline}</strong>
              <span className="sc-muted">{copy.label} · {formatDate(last.createdAt)} · {STATUS_LABELS[last.status]}</span>
              <p>{copy.next}</p>
              <Link to={`/screenings/${last.id}`} className="btn btn--ghost" style={{ alignSelf: 'flex-start' }}>See which answers contributed</Link>
              <p className="sc-hint">{DISCLAIMER}</p>
            </div>
          )}
        </div>
      </article>

      <article className="db-card" aria-label="Open actions">
        <div className="db-card__header"><h2 className="db-card__title">Open actions</h2></div>
        <div className="db-card__body">
          {loading ? null : overview?.openActions.length ? (
            <ul className="sc-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
              {overview.openActions.map((a) => <li key={a.id}><Link to={a.to}>{a.label} →</Link></li>)}
            </ul>
          ) : (
            <p className="sc-muted" role="status">Nothing needs your attention right now.</p>
          )}
        </div>
      </article>
    </div>
  )
}
