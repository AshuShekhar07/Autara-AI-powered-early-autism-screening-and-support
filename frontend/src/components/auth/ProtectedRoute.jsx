import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * ProtectedRoute
 *
 * Usage:
 *   <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
 *     <Dashboard />
 *   </ProtectedRoute>
 *
 * Behaviour:
 *   - While auth is resolving  → render a minimal spinner (no flash of login page)
 *   - Not authenticated        → redirect to /login (preserving attempted path in `state`)
 *   - Authenticated, wrong role → redirect to /not-authorized
 *   - Authenticated, correct role → render children
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth()
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

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/not-authorized" replace />
  }

  return children
}
