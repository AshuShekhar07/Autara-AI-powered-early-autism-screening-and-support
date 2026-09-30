import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ChildProvider } from './context/ChildContext'
import ProtectedRoute      from './components/auth/ProtectedRoute'
import AuthPage            from './pages/auth/AuthPage'
import Dashboard           from './pages/Dashboard'
import ClinicianDashboard  from './pages/ClinicianDashboard'
import TherapistDashboard  from './pages/clinical/TherapistDashboard'
import ChildWorkspace      from './pages/clinical/ChildWorkspace'
import CasePage            from './pages/clinical/CasePage'
import AdminDashboard      from './pages/admin/AdminDashboard'
import Screening           from './pages/Screening'
import ScreeningResult     from './pages/ScreeningResult'
import Behaviour           from './pages/Behaviour'
import History             from './pages/History'
import Ask                 from './pages/Ask'
import NotAuthorized       from './pages/NotAuthorized'
import ChildProfile        from './pages/ChildProfile'
import Milestones          from './pages/Milestones'
import PendingVerification from './pages/PendingVerification'
import RootRedirect        from './components/auth/RootRedirect'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChildProvider>
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

          <Route
            path="/behaviour"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <Behaviour />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ask"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <Ask />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <History />
              </ProtectedRoute>
            }
          />

          <Route
            path="/screenings/:id"
            element={
              <ProtectedRoute allowedRoles={['caregiver', 'patient']}>
                <ScreeningResult />
              </ProtectedRoute>
            }
          />

          {/* ── Protected: therapist (verified) ── */}
          <Route path="/therapist" element={<ProtectedRoute allowedRoles={['therapist']}><TherapistDashboard /></ProtectedRoute>} />
          <Route path="/therapist/children/:id" element={<ProtectedRoute allowedRoles={['therapist']}><ChildWorkspace /></ProtectedRoute>} />
          <Route path="/therapist/cases/:screeningId" element={<ProtectedRoute allowedRoles={['therapist']}><CasePage /></ProtectedRoute>} />

          {/* ── Protected: clinician (verified) ── */}
          <Route path="/clinician" element={<ProtectedRoute allowedRoles={['clinician']}><ClinicianDashboard /></ProtectedRoute>} />
          <Route path="/clinician/caseload" element={<ProtectedRoute allowedRoles={['clinician']}><ClinicianDashboard caseloadOnly /></ProtectedRoute>} />
          <Route path="/clinician/children/:id" element={<ProtectedRoute allowedRoles={['clinician']}><ChildWorkspace /></ProtectedRoute>} />
          <Route path="/clinician/cases/:screeningId" element={<ProtectedRoute allowedRoles={['clinician']}><CasePage /></ProtectedRoute>} />

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

          {/* ── Protected: admin ── */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />

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
        </ChildProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
