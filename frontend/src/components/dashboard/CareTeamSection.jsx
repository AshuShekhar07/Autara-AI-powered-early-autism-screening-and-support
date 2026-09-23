import React from 'react'
import './CareTeamSection.css'

// ─────────────────────────────────────────────────────────────────────────────
// Care team data adapter
// ─────────────────────────────────────────────────────────────────────────────
// TODO: Replace getCareTeam() with a real API call:
//   const res  = await fetch('/api/care-team', { headers: { Authorization: `Bearer ${token}` } })
//   const data = await res.json()
// When the backend is ready, swap the function body below.
//
// Expected shape of each professional:
//   { id, name, role, speciality, status: 'connected' | 'pending' | 'invited' }
//
// IMPORTANT: Do NOT seed fake professionals into MongoDB.
// The demo array below is clearly isolated for UI development and is NEVER
// written to the database. In production, this returns [] → empty state renders.
// ─────────────────────────────────────────────────────────────────────────────

const USE_DEMO_DATA = true

function getCareTeam() {
  if (!USE_DEMO_DATA) return []
  // Demo data — clearly marked, never persisted
  return [
    {
      id:         'demo-ct-1',
      name:       'Dr. A. Mehta',
      speciality: 'Developmental Pediatrician',
      status:     'connected',
      initials:   'AM',
    },
    {
      id:         'demo-ct-2',
      name:       'S. O\'Brien',
      speciality: 'Speech-Language Therapist',
      status:     'pending',
      initials:   'SO',
    },
  ]
}

/** Avatar with initials for a professional. */
function ProfessionalAvatar({ initials, name }) {
  return (
    <div className="ct-avatar" aria-hidden="true" title={name}>
      {initials}
    </div>
  )
}

/** Status pill */
function StatusPill({ status }) {
  const labels = {
    connected: 'Connected',
    pending:   'Pending',
    invited:   'Invited',
  }
  return (
    <span className={`ct-status ct-status--${status}`}>
      <span className="ct-status__dot" aria-hidden="true" />
      {labels[status] || status}
    </span>
  )
}

/**
 * CareTeamSection
 *
 * Shows connected professionals for the child's care journey.
 * Uses getCareTeam() adapter — swap to real API when backend is ready.
 * Shows empty state when no professionals are connected.
 */
export default function CareTeamSection() {
  // In production: fetch from /api/care-team and handle loading/error states
  const [team] = React.useState(getCareTeam)

  return (
    <section className="ct-section" aria-labelledby="ct-heading">
      <div className="ct-section__header">
        <h2 className="ct-section__title" id="ct-heading">Care Team</h2>
        <p className="ct-section__sub">Your child's care team</p>
      </div>

      {team.length === 0 ? (
        /* ── Empty state ── */
        <div className="ct-empty" role="status">
          <div className="ct-empty__icon" aria-hidden="true">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="ct-empty__title">No professionals connected yet</p>
          <p className="ct-empty__body">
            Connect a therapist or clinician to collaborate on your child's support journey.
          </p>
        </div>
      ) : (
        /* ── Professional list ── */
        <ul className="ct-list" role="list">
          {team.map(pro => (
            <li key={pro.id} className="ct-professional">
              <ProfessionalAvatar initials={pro.initials} name={pro.name} />
              <div className="ct-professional__info">
                <span className="ct-professional__name">{pro.name}</span>
                <span className="ct-professional__role">{pro.speciality}</span>
              </div>
              <StatusPill status={pro.status} />
            </li>
          ))}
        </ul>
      )}

      {/* ── Connect CTA — always visible ── */}
      <div className="ct-section__footer">
        <button
          type="button"
          className="ct-connect-btn"
          aria-label="Connect a professional to your child's care team"
          onClick={() => {
            // TODO: Open professional connection flow / modal
            // Future: navigate to /connect-professional or open a modal
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
          Connect a Professional
        </button>
      </div>
    </section>
  )
}
