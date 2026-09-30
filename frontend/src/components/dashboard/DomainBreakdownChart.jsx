import React from 'react'
import './Charts.css'

/**
 * DomainBreakdownChart — horizontal bars, one per developmental area.
 *
 * Props:
 *   domains — [{ domain, label, atRiskCount, totalItems }]  (from a screening's domainBreakdown)
 *   loading / error — optional states
 *
 * The grouping is Autara's own (NOT part of the official M-CHAT-R) and is labelled as such.
 */
export default function DomainBreakdownChart({ domains = [], loading = false, error = null }) {
  const hasData = Array.isArray(domains) && domains.length > 0

  return (
    <article className="db-card" aria-label="Domain breakdown chart">
      <div className="db-card__header">
        <div>
          <h2 className="db-card__title">Flagged answers by area</h2>
          <p className="db-card__subtitle">From the latest screening · Autara grouping, not part of the official instrument</p>
        </div>
      </div>
      <div className="db-card__body">
        {loading ? (
          <div className="chart-empty" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
        ) : error ? (
          <div className="chart-empty" role="alert"><p className="chart-empty__title">Couldn't load this chart</p><p className="chart-empty__body">{error}</p></div>
        ) : hasData ? (
          <DomainBars domains={domains} />
        ) : (
          <div className="chart-empty" role="status" aria-label="No domain data yet">
            <div className="chart-empty__icon" aria-hidden="true">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <p className="chart-empty__title">No screening yet</p>
            <p className="chart-empty__body">After a screening, you'll see which areas had flagged answers.</p>
          </div>
        )}
      </div>
    </article>
  )
}

function DomainBars({ domains }) {
  return (
    <div className="domain-bars" role="list" aria-label="Flagged answers per area">
      {domains.map(({ domain, label, atRiskCount, totalItems }) => {
        const pct = totalItems ? Math.round((atRiskCount / totalItems) * 100) : 0
        return (
          <div key={domain} className="domain-bar__row" role="listitem">
            <span className="domain-bar__label" title={label || domain}>{label || domain}</span>
            <div
              className="domain-bar__track"
              role="progressbar"
              aria-label={`${label || domain}: ${atRiskCount} of ${totalItems} answers flagged`}
              aria-valuenow={atRiskCount}
              aria-valuemin={0}
              aria-valuemax={totalItems}
            >
              <div className="domain-bar__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="domain-bar__score">{atRiskCount}/{totalItems}</span>
          </div>
        )
      })}
    </div>
  )
}
