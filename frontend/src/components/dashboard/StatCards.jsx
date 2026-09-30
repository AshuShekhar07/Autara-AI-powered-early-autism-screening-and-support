import React from 'react'
import { Link } from 'react-router-dom'
import { TIER_COPY } from '../../lib/screeningCopy'
import { formatDate } from '../../lib/format'
import './StatCards.css'

const icon = (children) => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
)

function StatCard({ label, value, meta, to, icon: ic, loading }) {
  const isEmpty = !loading && (value === null || value === undefined)
  const body = (
    <>
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div className="stat-card__icon" aria-hidden="true">{ic}</div>
      </div>
      <div className={`stat-card__value${isEmpty || loading ? ' stat-card__value--empty' : ''}`}>
        {loading ? '…' : isEmpty ? 'No data yet' : value}
      </div>
      {meta && <p className="stat-card__meta">{loading ? '' : meta}</p>}
    </>
  )
  return to && !isEmpty
    ? <Link to={to} className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link>
    : <article className="stat-card">{body}</article>
}

/**
 * Real stat cards from GET /api/children/:id/overview.
 * Props: overview (object | null), loading, error
 */
export default function StatCards({ overview, loading = false, error = '' }) {
  if (error) {
    return <section className="stat-cards" aria-label="Screening statistics"><div className="status-box status-box--error" role="alert" style={{ gridColumn: '1 / -1' }}>Couldn't load your summary: {error}</div></section>
  }
  const last = overview?.lastScreening
  return (
    <section className="stat-cards" aria-label="Summary">
      <StatCard
        label="Last screening" loading={loading}
        value={last ? TIER_COPY[last.effectiveRiskTier]?.label : null}
        meta={last ? `${formatDate(last.createdAt)} · view result →` : 'Complete a screening to see a result'}
        to={last ? `/screenings/${last.id}` : undefined}
        icon={icon(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>)}
      />
      <StatCard
        label="Screenings" loading={loading}
        value={overview && overview.screeningCount > 0 ? overview.screeningCount : null}
        meta="completed so far"
        icon={icon(<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>)}
      />
      <StatCard
        label="Logs this week" loading={loading}
        value={overview ? overview.logsThisWeek : null}
        meta="behaviour entries in the last 7 days" to="/behaviour"
        icon={icon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>)}
      />
      <StatCard
        label="Open actions" loading={loading}
        value={overview ? overview.openActions.length : null}
        meta={overview?.openActions.length ? 'see the list below' : 'nothing needs your attention'}
        icon={icon(<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></>)}
      />
    </section>
  )
}
