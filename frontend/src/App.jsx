import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute      from './components/auth/ProtectedRoute'
import AuthPage            from './pages/auth/AuthPage'
import Dashboard           from './pages/Dashboard'
import ClinicianDashboard  from './pages/ClinicianDashboard'
import Screening           from './pages/Screening'
import NotAuthorized       from './pages/NotAuthorized'
import ChildProfile        from './pages/ChildProfile'
import Milestones          from './pages/Milestones'
import PendingVerification from './pages/PendingVerification'
import RootRedirect        from './components/auth/RootRedirect'

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

          {/* ── Protected: child profile (caregiver + patient) ── */}
          <Route
            path="/child-profile"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <ChildProfile />
              </ProtectedRoute>
            }
          />

          {/* ── Protected: developmental milestones (caregiver + patient) ── */}
          <Route
            path="/milestones"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <Milestones />
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

          {/* ── Protected: therapist (verified) ── */}
          <Route
            path="/therapist"
            element={
              <ProtectedRoute allowedRoles={['therapist']}>
                <ClinicianDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Protected: clinician (verified) ── */}
          <Route
            path="/clinician"
            element={
              <ProtectedRoute allowedRoles={['clinician']}>
                <ClinicianDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Unverified therapist / clinician ── */}
          <Route
            path="/pending-verification"
            element={
              <ProtectedRoute allowedRoles={['therapist', 'clinician']} allowUnverified>
                <PendingVerification />
              </ProtectedRoute>
            }
          />

          {/* Old path → role home */}
          <Route path="/clinician-dashboard" element={<RootRedirect />} />

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
          <Route path="/" element={<RootRedirect />} />

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
