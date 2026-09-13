import React from 'react'
import { Link } from 'react-router-dom'

export default function NotAuthorized() {
  return (
    <div className="stub-page">
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'var(--notice-bg)', border: '1.5px solid var(--notice-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
      }}>
        <svg width="26" height="26" fill="none" stroke="var(--notice-text)" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <h1 style={{ color: 'var(--notice-text)' }}>Access restricted</h1>
      <p>You don't have permission to view this page. Please contact your administrator if you think this is an error.</p>
      <Link to="/" className="btn btn--ghost" style={{ marginTop: 12, textDecoration: 'none' }}>
        Go home
      </Link>
    </div>
  )
}
