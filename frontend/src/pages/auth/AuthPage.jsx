import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthToggle from '../../components/auth/AuthToggle'
import LoginForm  from './LoginForm'
import SignupForm from './SignupForm'
import './AuthPage.css'

/**
 * AuthPage — the single entry point for authentication.
 *
 * URL-aware: ?tab=signup opens the signup form directly.
 * (Used when the router points /signup → AuthPage with tab param.)
 */
export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <main className="auth-page" id="main-content">
      {/* Skip-to-content anchor target */}
      <a href="#auth-card" className="skip-link">Skip to sign-in form</a>

      {/* Logo + wordmark */}
      <div className="auth-page__brand" aria-hidden="true">
        {/* Inline SVG leaf mark that mirrors the aesthetic of the logo asset */}
        <svg
          className="auth-page__logo-mark"
          width="44" height="44"
          viewBox="0 0 44 44" fill="none"
          aria-hidden="true"
        >
          <rect width="44" height="44" rx="12" fill="#2F6F62" />
          <path
            d="M22 10c0 0-10 6-10 14a10 10 0 0 0 20 0C32 16 22 10 22 10z"
            fill="rgba(255,255,255,.92)"
          />
          <path
            d="M22 14v18"
            stroke="#2F6F62" strokeWidth="2" strokeLinecap="round"
          />
        </svg>
        <div className="auth-page__wordmark">
          <span className="auth-page__name">Autara</span>
          <span className="auth-page__tagline">Early Support &amp; Guidance</span>
        </div>
      </div>

      {/* Card */}
      <section
        className="auth-card"
        id="auth-card"
        aria-label={activeTab === 'login' ? 'Log in' : 'Create an account'}
      >
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
