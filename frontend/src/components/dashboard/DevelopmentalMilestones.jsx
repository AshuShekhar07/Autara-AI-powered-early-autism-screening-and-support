import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './DevelopmentalMilestones.css'

// ─────────────────────────────────────────────────────────────────────────────
// Milestone categories — informational/support content only.
// Status values: 'not_reviewed' | 'in_progress' | 'reviewed'
// This is NOT a diagnostic score system. No probability, risk, or clinical
// judgment is displayed. Content is structured but NOT medically diagnostic.
//
// Source guidance: CDC Developmental Milestones
// https://www.cdc.gov/ncbddd/actearly/milestones/index.html
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id:    'language',
    label: 'Language & Communication',
    icon:  (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id:    'social',
    label: 'Social Development',
    icon:  (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id:    'motor',
    label: 'Movement & Motor Skills',
    icon:  (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v5l3 3"/>
        <path d="M9 12H6l-2 5h5l1-3"/>
        <path d="M15 12h3l2 5h-5l-1-3"/>
      </svg>
    ),
  },
  {
    id:    'cognitive',
    label: 'Cognitive & Learning',
    icon:  (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a9 9 0 0 1 9 9c0 3.5-2 6.6-5 8.2V21H8v-1.8C5 17.6 3 14.5 3 11a9 9 0 0 1 9-9z"/>
        <line x1="9" y1="21" x2="15" y2="21"/>
      </svg>
    ),
  },
  {
    id:    'adaptive',
    label: 'Adaptive & Daily Living',
    icon:  (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
]

const STATUS_CONFIG = {
  not_reviewed: { label: 'Not reviewed', className: 'ms-status--neutral'  },
  in_progress:  { label: 'In progress',  className: 'ms-status--progress' },
  reviewed:     { label: 'Reviewed',     className: 'ms-status--reviewed' },
}

/**
 * Derive the relevant age band label from child's date of birth.
 * Returns a string like "2–3 years" or null if DOB is unavailable.
 */
function getAgeBand(childDob) {
  if (!childDob) return null
  const birth = new Date(childDob)
  if (isNaN(birth.getTime())) return null
  const ageMonths = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (ageMonths < 2)   return 'Birth – 2 months'
  if (ageMonths < 4)   return '2–4 months'
  if (ageMonths < 6)   return '4–6 months'
  if (ageMonths < 9)   return '6–9 months'
  if (ageMonths < 12)  return '9–12 months'
  if (ageMonths < 18)  return '12–18 months'
  if (ageMonths < 24)  return '18–24 months'
  if (ageMonths < 36)  return '2–3 years'
  if (ageMonths < 48)  return '3–4 years'
  if (ageMonths < 60)  return '4–5 years'
  return '5+ years'
}

/**
 * DevelopmentalMilestones
 *
 * Informational section only — NOT a diagnostic tool.
 * Displays five developmental categories with user-driven status tags.
 * Status defaults to 'not_reviewed'; caregivers can update via the milestones page.
 *
 * TODO: Persist category statuses per user via GET/PUT /api/milestones
 * when that endpoint is built. For now, statuses are UI state only.
 */
export default function DevelopmentalMilestones() {
  const { profileData } = useAuth()
  const childDob  = profileData?.roleDetails?.childDob || null
  const ageBand   = getAgeBand(childDob)

  // UI-only status state — not persisted yet
  // TODO: Load from GET /api/milestones and persist via PUT /api/milestones
  const [statuses, setStatuses] = React.useState(() =>
    Object.fromEntries(CATEGORIES.map(c => [c.id, 'not_reviewed']))
  )

  function cycleStatus(id) {
    const order = ['not_reviewed', 'in_progress', 'reviewed']
    setStatuses(prev => {
      const current = prev[id]
      const next    = order[(order.indexOf(current) + 1) % order.length]
      return { ...prev, [id]: next }
    })
  }

  return (
    <section className="ms-section" aria-labelledby="ms-heading">
      <div className="ms-section__header">
        <div>
          <h2 className="ms-section__title" id="ms-heading">Developmental Milestones</h2>
          <p className="ms-section__sub">
            {ageBand
              ? <>Based on your child's age <span className="ms-section__band">{ageBand}</span></>
              : 'Add your child\'s date of birth to see age-specific milestones.'
            }
          </p>
        </div>
        <Link to="/milestones" className="ms-section__view-all" aria-label="View all developmental milestones">
          View All Milestones
        </Link>
      </div>

      <ul className="ms-list" role="list">
        {CATEGORIES.map(cat => {
          const status = statuses[cat.id]
          const cfg    = STATUS_CONFIG[status]
          return (
            <li key={cat.id} className="ms-item">
              <span className="ms-item__icon" aria-hidden="true">
                {cat.icon}
              </span>
              <span className="ms-item__label">{cat.label}</span>
              <button
                type="button"
                className={`ms-status ${cfg.className}`}
                onClick={() => cycleStatus(cat.id)}
                aria-label={`${cat.label} — status: ${cfg.label}. Click to change.`}
                title="Click to update status"
              >
                {cfg.label}
              </button>
              <Link
                to="/milestones"
                className="ms-item__review-link"
                aria-label={`Review ${cat.label} milestones`}
              >
                Review milestones
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="ms-section__footer">
        <p className="ms-section__source">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Milestone guidance is informed by CDC developmental resources. This is an
          informational tracking tool, not a clinical assessment.
        </p>
      </div>
    </section>
  )
}
