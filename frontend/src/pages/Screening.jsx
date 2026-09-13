import React from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'

/**
 * Screening — placeholder page
 *
 * The screening flow doesn't exist yet. This page gives the user honest
 * feedback when they click "Start New Screening" instead of a dead route.
 *
 * TODO: Replace this entire page with the real screening flow once built.
 */
export default function Screening() {
  return (
    <DashboardLayout activeNav="screening" pageTitle="New Screening">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '20px',
        textAlign: 'center',
        padding: '40px 24px',
      }}>
        {/* Illustration */}
        <div style={{
          width: 72, height: 72,
          borderRadius: 18,
          background: 'var(--brand-lt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--brand)',
        }} aria-hidden="true">
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>

        <div>
          <h1 style={{
            fontFamily: 'var(--font-head)',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: '-.03em',
            marginBottom: '10px',
          }}>
            Screening flow coming soon
          </h1>
          <p style={{
            fontSize: '.95rem',
            color: 'var(--ink-muted)',
            maxWidth: '400px',
            lineHeight: 1.6,
          }}>
            We're building the screening questionnaire now. It'll walk you
            through a set of age-appropriate questions and produce a scored
            report you can share with your care team.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="btn btn--ghost"
          style={{ marginTop: '8px' }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    </DashboardLayout>
  )
}
