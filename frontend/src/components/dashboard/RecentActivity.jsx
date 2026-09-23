import React from 'react'
import './RecentActivity.css'

// ─────────────────────────────────────────────────────────────────────────────
// Recent activity adapter
// ─────────────────────────────────────────────────────────────────────────────
// TODO: Replace getRecentActivity() with:
//   GET /api/activity
//   Returns: [{ id, type, label, timestamp }]
//
// Possible activity types:
//   'profile_update' | 'milestone_review' | 'resource_saved' |
//   'care_team_request' | 'screening_started' | 'report_viewed'
//
// In production, use the empty array → shows empty state.
// Demo data below is ONLY for UI development and is clearly isolated.
// ─────────────────────────────────────────────────────────────────────────────

const USE_DEMO_DATA = true

function getRecentActivity() {
  if (!USE_DEMO_DATA) return []
  const now = Date.now()
  return [
    {
      id:        'act-1',
      type:      'profile_update',
      label:     'Child profile updated',
      timestamp: now - 2 * 60 * 60 * 1000,        // 2 hours ago
    },
    {
      id:        'act-2',
      type:      'milestone_review',
      label:     'Developmental milestones reviewed',
      timestamp: now - 26 * 60 * 60 * 1000,       // yesterday
    },
    {
      id:        'act-3',
      type:      'resource_saved',
      label:     'Resource saved',
      timestamp: new Date('2026-09-12').getTime(), // fixed date
    },
    {
      id:        'act-4',
      type:      'care_team_request',
      label:     'Care team request sent',
      timestamp: new Date('2026-09-10').getTime(),
    },
  ]
}

/** Returns a relative time label and optional exact date string. */
function formatActivity(ts) {
  const diffMs   = Date.now() - ts
  const diffDays = Math.floor(diffMs / 86400000)
  const date     = new Date(ts)

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

/**
 * RecentActivity
 *
 * Vertical timeline of user actions inside Autara.
 * Uses getRecentActivity() adapter — swap to real API when available.
 * Shows empty state when no events exist.
 */
export default function RecentActivity() {
  // In production: fetch from GET /api/activity
  const [activities] = React.useState(getRecentActivity)

  return (
    <section className="ra-section" aria-labelledby="ra-heading">
      <div className="ra-section__header">
        <h2 className="ra-section__title" id="ra-heading">Recent Activity</h2>
      </div>

      {activities.length === 0 ? (
        /* ── Empty state ── */
        <div className="ra-empty" role="status">
          <div className="ra-empty__icon" aria-hidden="true">
            <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15 15"/>
            </svg>
          </div>
          <p className="ra-empty__title">No recent activity yet</p>
          <p className="ra-empty__body">
            Your activity will appear here as you use Autara.
          </p>
        </div>
      ) : (
        /* ── Activity timeline ── */
        <ol className="ra-timeline" aria-label="Recent activity">
          {activities.map(act => {
            const { relative, time } = formatActivity(act.timestamp)
            const icon = TYPE_ICONS[act.type] || TYPE_ICONS.profile_update
            return (
              <li key={act.id} className="ra-event">
                <span className="ra-event__icon" aria-hidden="true">{icon}</span>
                <div className="ra-event__body">
                  <span className="ra-event__label">{act.label}</span>
                  <span className="ra-event__time">
                    {relative}
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
