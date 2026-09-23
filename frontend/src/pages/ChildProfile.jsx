import React from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import './ChildProfile.css'

/**
 * Calculates age string from ISO date string.
 * Returns human-readable label or null.
 */
function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const now    = new Date()
  let years    = now.getFullYear() - birth.getFullYear()
  let months   = now.getMonth()    - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (now.getDate() < birth.getDate()) months = Math.max(0, months - 1)
  const parts = []
  if (years  > 0) parts.push(`${years} year${years  > 1 ? 's' : ''}`)
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' ') : 'Less than 1 month'
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ChildAvatar({ name }) {
  const initials = (() => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  })()
  return <div className="cppage-avatar">{initials}</div>
}

/**
 * ChildProfile page (/child-profile)
 *
 * Shows the full child profile using existing roleDetails data.
 * Future: Add edit form and profile photo upload.
 *
 * TODO: Add PUT /api/profile to allow editing child name, DOB, and relationship.
 */
export default function ChildProfile() {
  const { profileData, role } = useAuth()
  const roleDetails = profileData?.roleDetails || {}
  const childName   = roleDetails.childName || null
  const childDob    = roleDetails.childDob  || null
  const ageLabel    = calcAge(childDob)
  const dobFormatted = formatDate(childDob)

  return (
    <DashboardLayout activeNav="dashboard" pageTitle="Child Profile">
      <div className="cppage-container">

        {/* ── Back link ── */}
        <Link to="/dashboard" className="cppage-back" aria-label="Back to dashboard">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Dashboard
        </Link>

        {/* ── Profile card ── */}
        <section className="cppage-card" aria-labelledby="cppage-heading">
          {/* Avatar */}
          <div className="cppage-card__top">
            <ChildAvatar name={childName} />
            <div className="cppage-card__name-block">
              <h1 className="cppage-card__name" id="cppage-heading">
                {childName || <span className="cppage-not-provided">Name not provided</span>}
              </h1>
              {ageLabel && (
                <span className="cppage-card__age">{ageLabel}</span>
              )}
            </div>
          </div>

          {/* Details */}
          <dl className="cppage-details">
            <div className="cppage-detail">
              <dt>Date of Birth</dt>
              <dd>{dobFormatted || <span className="cppage-not-provided">Not provided</span>}</dd>
            </div>
            <div className="cppage-detail">
              <dt>Relationship</dt>
              <dd>
                {roleDetails.relationship
                  ? roleDetails.relationship
                  : role === 'caregiver'
                    ? 'Caregiver'
                    : <span className="cppage-not-provided">Not provided</span>
                }
              </dd>
            </div>
            <div className="cppage-detail">
              <dt>Account role</dt>
              <dd className="cppage-detail__role">{role}</dd>
            </div>
          </dl>

          {/* Hint when DOB is missing */}
          {!childDob && (
            <div className="cppage-hint" role="note">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Adding your child's date of birth will unlock age-specific developmental milestone guidance.
            </div>
          )}

          {/* Edit notice — edit form is future work */}
          <div className="cppage-edit-notice">
            <p>
              Profile editing will be available soon. Fields are populated from your account
              registration and can be updated through account settings.
            </p>
          </div>
        </section>

        {/* ── Quick links ── */}
        <section className="cppage-quick" aria-label="Quick actions">
          <Link to="/milestones" className="cppage-quick__link">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            View Developmental Milestones
          </Link>
          <Link to="/dashboard" className="cppage-quick__link">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            Return to Dashboard
          </Link>
        </section>

      </div>
    </DashboardLayout>
  )
}
