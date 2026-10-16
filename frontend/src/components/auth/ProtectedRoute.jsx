import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isClinicalRole } from '../../lib/roles'

/**
 * ProtectedRoute
 *
 * Usage:
 *   <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
 *     <Dashboard />
 *   </ProtectedRoute>
 *
 * Behaviour:
 *   - While auth is resolving        → spinner (no flash of login page)
 *   - Not authenticated              → /login (attempted path kept in `state`)
 *   - Signed in but no Autara profile→ friendly error with retry / log out
 *   - Unverified therapist/clinician → /pending-verification
 *     (unless `allowUnverified`, used by the pending page itself)
 *   - Wrong role                     → /not-authorized
 */
export default function ProtectedRoute({ children, allowedRoles, allowUnverified = false }) {
  const { user, role, verified, loading, hydrateProfile, logout } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-loading" aria-live="polite" aria-label="Loading…">
        <div className="spinner spinner--brand" role="status" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!role) {
    return (
      <div className="stub-page">
        <h1>We couldn't load your profile</h1>
        <p>
          Your sign-in worked, but we couldn't find your Autara profile. This can
          happen if sign-up didn't finish or the server is unreachable.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn--ghost" onClick={() => hydrateProfile()}>Try again</button>
          <button type="button" className="btn btn--ghost" onClick={() => logout()}>Log out</button>
        </div>
      </div>
    )
  }

  if (isClinicalRole(role) && !verified && !allowUnverified) {
    return <Navigate to="/pending-verification" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/not-authorized" replace />
  }

  return children
}
