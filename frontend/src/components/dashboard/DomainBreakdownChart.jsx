import React from 'react'
import './Charts.css'

/**
 * DomainBreakdownChart
 *
 * Reusable horizontal bar chart showing scores per developmental domain.
 *
 * Props:
 *   domains — array of { domain: string, score: number (0–100) }
 *
 * TODO: replace with real data from GET /api/screenings/:id/domains once built.
 * The API should return domain-level scores from the most recent screening.
 * Map each domain result to { domain: result.domainName, score: result.score }.
 *
 * When `domains` is empty or not provided, an honest empty state is shown.
 */
export default function DomainBreakdownChart({ domains = [] }) {
  const hasData = Array.isArray(domains) && domains.length > 0

  return (
    <article className="db-card" aria-label="Domain breakdown chart">
      <div className="db-card__header">
        <div>
          <h2 className="db-card__title">Domain Breakdown</h2>
          <p className="db-card__subtitle">Scores across developmental areas</p>
        </div>
      </div>
      <div className="db-card__body">
        {hasData ? (
          <DomainBars domains={domains} />
        ) : (
          <div className="chart-empty" role="status" aria-label="No domain data yet">
            <div className="chart-empty__icon" aria-hidden="true">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
              </svg>
            </div>
            <p className="chart-empty__title">No domain data yet</p>
            <p className="chart-empty__body">
              After your first screening, you'll see scores broken down by
              areas like language, motor skills, and social development.
            </p>
          </div>
        )}
      </div>
    </article>
  )
}

function DomainBars({ domains }) {
  return (
    <div className="domain-bars" role="list" aria-label="Domain scores">
      {domains.map(({ domain, score }) => (
        <div key={domain} className="domain-bar__row" role="listitem">
          <span className="domain-bar__label" title={domain}>{domain}</span>
          <div
            className="domain-bar__track"
            aria-label={`${domain}: ${score} out of 100`}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="domain-bar__fill" style={{ width: `${score}%` }} />
          </div>
          <span className="domain-bar__score">{score}</span>
        </div>
      ))}
    </div>
  )
}
