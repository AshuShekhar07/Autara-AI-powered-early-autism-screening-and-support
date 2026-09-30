import React from 'react'
import { Link } from 'react-router-dom'
import { useChildren } from '../../context/ChildContext'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import './RecentActivity.css'

/** Returns a relative time label and optional exact date string. */
function formatActivity(iso) {
  const date     = new Date(iso)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000)

  if (diffDays === 0) {
    const label = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return { relative: 'Today', time: label }
  }
  if (diffDays === 1) {
    return { relative: 'Yesterday', time: null }
  }
  if (diffDays < 7) {
    return { relative: `${diffDays} days ago`, time: null }
  }
  const exact = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  return { relative: exact, time: null }
}

const TYPE_ICONS = {
  screening: null, review: null, annotation: null, behaviour_log: null, session_note: null,
  profile_update:     (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  milestone_review:   (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  resource_saved:     (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  care_team_request:  (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  screening_started:  (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  report_viewed:      (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
}

const ICON_FOR = { screening: 'screening_started', review: 'milestone_review', behaviour_log: 'report_viewed', annotation: 'milestone_review', session_note: 'report_viewed' }

/**
 * RecentActivity — vertical timeline built from REAL data:
 * GET /api/children/:id/timeline (screenings, clinician reviews, behaviour logs).
 */
export default function RecentActivity() {
  const { activeChild } = useChildren()
  const childId = activeChild?.id
  const { data, loading, error, reload } = useApi(
    () => api.get(`/api/children/${childId}/timeline`, { limit: 8 }), [childId], !!childId
  )
  const activities = data?.events || []

  return (
    <section className="ra-section" aria-labelledby="ra-heading">
      <div className="ra-section__header">
        <h2 className="ra-section__title" id="ra-heading">Recent Activity</h2>
      </div>

      {loading ? (
        <div className="ra-empty" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      ) : error ? (
        <div className="ra-empty" role="alert">
          <p className="ra-empty__title">Couldn't load activity</p>
          <button type="button" className="sc-link-btn" onClick={reload}>Try again</button>
        </div>
      ) : activities.length === 0 ? (
        <div className="ra-empty" role="status">
          <div className="ra-empty__icon" aria-hidden="true">
            <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
            </svg>
          </div>
          <p className="ra-empty__title">No recent activity yet</p>
          <p className="ra-empty__body">Screenings, behaviour logs and clinician reviews will appear here.</p>
        </div>
      ) : (
        <ol className="ra-timeline" aria-label="Recent activity">
          {activities.map((act) => {
            const { relative, time } = formatActivity(act.at)
            const icon = TYPE_ICONS[ICON_FOR[act.type]] || TYPE_ICONS.profile_update
            const to = act.ref?.kind === 'screening' ? `/screenings/${act.ref.id}` : act.ref?.kind === 'behaviour_log' ? '/behaviour' : null
            return (
              <li key={act.id} className="ra-event">
                <span className="ra-event__icon" aria-hidden="true">{icon}</span>
                <div className="ra-event__body">
                  <span className="ra-event__label">{to ? <Link to={to}>{act.title}</Link> : act.title}</span>
                  <span className="ra-event__time">
                    {act.summary} · {relative}
                    {time && <span className="ra-event__exact">, {time}</span>}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
