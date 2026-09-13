import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute      from './components/auth/ProtectedRoute'
import AuthPage            from './pages/auth/AuthPage'
import Dashboard           from './pages/Dashboard'
import ClinicianDashboard  from './pages/ClinicianDashboard'
import Screening           from './pages/Screening'
import NotAuthorized       from './pages/NotAuthorized'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public auth routes ── */}
          <Route path="/login"  element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />

          {/* ── Protected: caregiver + patient ── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Protected: screening flow (caregiver + patient) ── */}
          <Route
            path="/screening"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <Screening />
              </ProtectedRoute>
            }
          />

          {/* ── Protected: therapist + clinician ── */}
          <Route
            path="/clinician-dashboard"
            element={
              <ProtectedRoute allowedRoles={['therapist', 'clinician']}>
                <ClinicianDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Protected: admin (stub) ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <div className="stub-page">
                  <h1>Admin Console</h1>
                  <p>Admin workspace coming soon.</p>
                </div>
              </ProtectedRoute>
            }
          />

          {/* ── Error pages ── */}
          <Route path="/not-authorized" element={<NotAuthorized />} />

          {/* ── Root redirect ── */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ── 404 catch-all ── */}
          <Route path="*" element={
            <div className="stub-page">
              <h1>Page not found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
