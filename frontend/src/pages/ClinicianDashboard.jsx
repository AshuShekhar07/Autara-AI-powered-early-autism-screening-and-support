import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ClinicianDashboard() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="stub-page">
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'var(--brand)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
      }}>
        <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      </div>
      <h1>Clinician Dashboard</h1>
      <p>
        Welcome{user?.email ? `, ${user.email}` : ''}!
        You're logged in as <strong>{role}</strong>.
        The clinical workspace is coming soon.
      </p>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={handleLogout}
        style={{ marginTop: 12 }}
      >
        Log out
      </button>
    </div>
  )
}
