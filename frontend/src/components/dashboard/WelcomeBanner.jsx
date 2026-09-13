import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './WelcomeBanner.css'

/**
 * WelcomeBanner
 *
 * Uses the authenticated user's real name (displayName) or email prefix
 * from AuthContext to personalise the greeting. No placeholder text.
 *
 * The "Start New Screening" CTA links to /screening.
 * That route is built but shows an honest "coming soon" placeholder until
 * the screening flow is implemented.
 */
export default function WelcomeBanner() {
  const { user } = useAuth()

  // Derive a friendly first name: prefer displayName, fall back to email prefix
  const firstName = (() => {
    if (user?.displayName) return user.displayName.trim().split(/\s+/)[0]
    if (user?.email) return user.email.split('@')[0]
    return 'there'
  })()

  // Determine time-of-day greeting
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening'

  return (
    <div className="welcome-banner" role="region" aria-label="Welcome">
      <div className="welcome-banner__text">
        <h1 className="welcome-banner__greeting">
          {timeGreeting}, {firstName} 👋
        </h1>
        <p className="welcome-banner__sub">
          Your child's developmental journey starts here. Run a screening
          whenever you're ready — it only takes a few minutes.
        </p>
      </div>

      <Link
        to="/screening"
        className="welcome-banner__cta"
        aria-label="Start a new screening"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8"  y1="12" x2="16" y2="12"/>
        </svg>
        Start New Screening
      </Link>
    </div>
  )
}
