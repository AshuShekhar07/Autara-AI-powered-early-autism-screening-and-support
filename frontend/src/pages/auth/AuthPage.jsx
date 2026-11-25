import React, { useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { homeRouteFor } from '../../lib/roles'
import AuthToggle from '../../components/auth/AuthToggle'
import LoginForm  from './LoginForm'
import SignupForm from './SignupForm'
import './AuthPage.css'

/**
 * AuthPage — the single entry point for authentication.
 *
 * URL-aware: /signup (or ?tab=signup) opens the signup form directly.
 */
export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const { pathname, state } = useLocation()
  // /signup and /login?tab=signup both open the signup form.
  const initialTab = pathname === '/signup' || searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  const [activeTab, setActiveTab] = useState(initialTab)
  const { user, role, verified, loading } = useAuth()

  // Already signed in (and profile loaded) → go straight to the role's home.
  if (!loading && user && role) return <Navigate to={homeRouteFor(role, verified)} replace />

  return (
    <main className="auth-page" id="main-content">
      {/* Skip-to-content anchor target */}
      <a href="#auth-card" className="skip-link">Skip to sign-in form</a>

      {/* Logo + wordmark */}
      <div className="auth-page__brand">
        {/* Inline SVG leaf mark that mirrors the aesthetic of the logo asset */}
        <svg
          className="auth-page__logo-mark"
          width="44" height="44"
          viewBox="0 0 44 44" fill="none"
          aria-hidden="true"
        >
          <rect width="44" height="44" rx="9" fill="#0B7A75" />
          <path
            d="M22 10c0 0-10 6-10 14a10 10 0 0 0 20 0C32 16 22 10 22 10z"
            fill="rgba(255,255,255,.92)"
          />
          <path
            d="M22 14v18"
            stroke="#0B7A75" strokeWidth="2" strokeLinecap="round"
          />
        </svg>
        <div className="auth-page__wordmark">
          <h1 className="auth-page__name">Autara</h1>
          <span className="auth-page__tagline">Early Support &amp; Guidance</span>
        </div>
      </div>

      {/* Card */}
      <section
        className="auth-card"
        id="auth-card"
        aria-label={activeTab === 'login' ? 'Log in' : 'Create an account'}
      >
        {state?.accountDeleted && (
          <div className="status-box status-box--ok" role="status" style={{ marginBottom: 16 }}>
            Your account and its data have been deleted.
          </div>
        )}
        <AuthToggle activeTab={activeTab} onChange={setActiveTab} />

        <div
          id={`auth-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`auth-tab-${activeTab}`}
        >
          {activeTab === 'login' ? <LoginForm /> : <SignupForm />}
        </div>
      </section>

      {/* Footer note */}
      <p className="auth-page__footer">
        {activeTab === 'login'
          ? <>No account yet?{' '}
              <button
                type="button"
                className="auth-page__switch-btn"
                onClick={() => setActiveTab('signup')}
              >Sign up</button>
            </>
          : <>Already have an account?{' '}
              <button
                type="button"
                className="auth-page__switch-btn"
                onClick={() => setActiveTab('login')}
              >Log in</button>
            </>
        }
      </p>
    </main>
  )
}
