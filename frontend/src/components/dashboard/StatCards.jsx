import React from 'react'
import './StatCards.css'

// TODO: replace with real data from GET /api/screenings once built.
// Expected shape: { lastScore: number|null, lastDate: string|null,
//                   totalCompleted: number, nextRescreen: string|null }

const EMPTY_STATE = {
  lastScore: null,
  lastDate: null,
  totalCompleted: 0,
  nextRescreen: null,
}

function StatCard({ label, value, meta, icon }) {
  const isEmpty = value === null || value === undefined || value === 0
  return (
    <article className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div className="stat-card__icon" aria-hidden="true">{icon}</div>
      </div>
      <div className={`stat-card__value${isEmpty ? ' stat-card__value--empty' : ''}`}>
        {isEmpty ? 'No data yet' : value}
      </div>
      {meta && <p className="stat-card__meta">{meta}</p>}
    </article>
  )
}

export default function StatCards({ data = EMPTY_STATE }) {
  const { lastScore, lastDate, totalCompleted, nextRescreen } = data

  return (
    <section className="stat-cards" aria-label="Screening statistics">
      <StatCard
        label="Last Score"
        value={lastScore !== null ? lastScore : null}
        meta={lastScore !== null ? 'out of 100 — see full report' : 'Complete your first screening to see your score'}
        icon={
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        }
      />
      <StatCard
        label="Last Screening"
        value={lastDate || null}
        meta={lastDate ? 'View full results →' : 'No screenings completed yet'}
        icon={
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        }
      />
      <StatCard
        label="Total Screenings"
        value={totalCompleted > 0 ? totalCompleted : null}
        meta={totalCompleted > 0 ? `${totalCompleted} screening${totalCompleted > 1 ? 's' : ''} completed` : 'Start your first screening today'}
        icon={
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        }
      />
      <StatCard
        label="Next Re-screen"
        value={nextRescreen || null}
        meta={nextRescreen ? 'Recommended re-assessment date' : 'Will be suggested after first screening'}
        icon={
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <polyline points="12 7 12 12 15 15"/>
          </svg>
        }
      />
    </section>
  )
}
