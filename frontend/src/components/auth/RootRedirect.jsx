import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { homeRouteFor } from '../../lib/roles'

/** "/" → login when signed out, otherwise the user's role home. */
export default function RootRedirect() {
  const { user, role, verified, loading } = useAuth()
  if (loading) return <div className="page-loading" aria-label="Loading…"><div className="spinner spinner--brand" role="status" /></div>
  if (!user || !role) return <Navigate to="/login" replace />
  return <Navigate to={homeRouteFor(role, verified)} replace />
}
