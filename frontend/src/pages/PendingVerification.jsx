import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homeRouteFor } from '../lib/roles'

/**
 * Shown to therapist / clinician accounts until an admin verifies them.
 * "Check again" re-reads the profile so approval takes effect without re-login.
 */
export default function PendingVerification() {
  const { role, verified, profileData, hydrateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [stillPending, setStillPending] = useState(false)

  if (verified) return <Navigate to={homeRouteFor(role, verified)} replace />

  async function check() {
    setChecking(true)
    setStillPending(false)
    const profile = await hydrateProfile()
    setChecking(false)
    if (profile?.verified) navigate(homeRouteFor(profile.role, true), { replace: true })
    else setStillPending(true)
  }

  const org = profileData?.roleDetails?.orgName

  return (
    <main className="stub-page" id="main-content">
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'var(--notice-bg)', border: '1.5px solid var(--notice-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} aria-hidden="true">
        <svg width="26" height="26" fill="none" stroke="var(--notice-text)" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
        </svg>
      </div>
      <h1>Verification pending</h1>
      <p>
        Thanks for signing up{profileData?.name ? `, ${profileData.name}` : ''}. Before you can see any
        children's data, an Autara administrator needs to verify your {role} credentials
        {org ? <> for <strong>{org}</strong></> : null}. This usually takes 1–2 business days.
      </p>
      {stillPending && (
        <div className="status-box status-box--notice" role="status">
          Your account hasn't been verified yet. We'll keep your details safe — check back soon.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn btn--ghost" onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={async () => { await logout(); navigate('/login', { replace: true }) }}>
          Log out
        </button>
      </div>
    </main>
  )
}
