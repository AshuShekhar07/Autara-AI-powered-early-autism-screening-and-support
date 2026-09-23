import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './ChildProfileCard.css'

/**
 * Calculates age string from an ISO date string (YYYY-MM-DD).
 * Returns { years, months, label } or null if dob is invalid.
 */
function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const now    = new Date()
  let years    = now.getFullYear() - birth.getFullYear()
  let months   = now.getMonth()    - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  // Day-of-month adjustment
  if (now.getDate() < birth.getDate()) months = Math.max(0, months - 1)
  const parts = []
  if (years  > 0) parts.push(`${years} year${years  > 1 ? 's' : ''}`)
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' ') : 'Less than 1 month'
}

/** Format ISO date as "12 January 2023". */
function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Avatar initials derived from a name string. */
function ChildAvatar({ name }) {
  const initials = (() => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  })()
  return (
    <div className="cp-avatar" aria-hidden="true">
      {initials}
    </div>
  )
}

/**
 * ChildProfileCard
 *
 * Reads childName and childDob from profileData.roleDetails (exposed by
 * AuthContext via the extended GET /api/auth/me response).
 * Falls back to "Not provided" for any missing field — does not invent data.
 *
 * "View Profile" → /child-profile
 * "Edit"         → /settings (existing nav item; currently a stub)
 */
export default function ChildProfileCard() {
  const { profileData, role } = useAuth()

  // Only caregivers and patients have a child profile
  if (role !== 'caregiver' && role !== 'patient') return null

  const roleDetails = profileData?.roleDetails || {}
  const childName   = roleDetails.childName || null
  const childDob    = roleDetails.childDob  || null
  const ageLabel    = calcAge(childDob)
  const dobFormatted = formatDate(childDob)

  return (
    <section className="cp-card" aria-labelledby="cp-heading">
      <div className="cp-card__header">
        <h2 className="cp-card__section-label" id="cp-heading">Child Profile</h2>
        <Link to="/child-profile" className="cp-card__edit-link" aria-label="Edit child profile">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </Link>
      </div>

      <div className="cp-card__body">
        <ChildAvatar name={childName} />

        <div className="cp-card__info">
          <div className="cp-card__name-row">
            <span className="cp-card__name">
              {childName || <span className="cp-card__not-provided">Not provided</span>}
            </span>
            {ageLabel && (
              <span className="cp-card__age">{ageLabel}</span>
            )}
          </div>

          <dl className="cp-card__details">
            <div className="cp-card__detail-row">
              <dt>Date of birth</dt>
              <dd>{dobFormatted || <span className="cp-card__not-provided">Not provided</span>}</dd>
            </div>
            <div className="cp-card__detail-row">
              <dt>Relationship</dt>
              {/* Relationship field not yet in schema; shown when available */}
              <dd>
                {roleDetails.relationship
                  ? roleDetails.relationship
                  : role === 'caregiver'
                    ? 'Caregiver'
                    : <span className="cp-card__not-provided">Not provided</span>
                }
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {!childDob && (
        <p className="cp-card__hint">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Add your child's date of birth to unlock age-specific milestones and insights.
        </p>
      )}

      <div className="cp-card__actions">
        <Link to="/child-profile" className="cp-card__btn cp-card__btn--primary">
          View Profile
        </Link>
        <Link to="/child-profile" className="cp-card__btn cp-card__btn--ghost">
          Edit
        </Link>
      </div>
    </section>
  )
}
