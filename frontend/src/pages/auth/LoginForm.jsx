import React, { useState, useId } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './AuthForms.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/* ── Inline field error component ── */
function FieldError({ id, message }) {
  if (!message) return null
  return (
    <span id={id} className="field__error" role="alert">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {message}
    </span>
  )
}

/* ── Validation ── */
function validateLogin({ email, password }) {
  const errs = {}
  if (!email.trim())                         errs.email    = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.'
  if (!password)                             errs.password = 'Password is required.'
  return errs
}

/* ── Redirect helper ── */
function dashboardRoute(role) {
  if (!role) return '/dashboard'
  if (role === 'admin') return '/admin'
  if (role === 'therapist' || role === 'clinician') return '/clinician-dashboard'
  return '/dashboard'
}

export default function LoginForm() {
  const uid = useId()
  const navigate  = useNavigate()
  const { login, hydrateProfile, user } = useAuth()

  const [fields,   setFields]   = useState({ email: '', password: '' })
  const [errors,   setErrors]   = useState({})
  const [formErr,  setFormErr]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const { resetPassword } = useAuth()

  function set(key, val) {
    setFields(f => ({ ...f, [key]: val }))
    // Clear the error for this field on change
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
    if (formErr)     setFormErr('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validateLogin(fields)
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setFormErr('')
    try {
      const cred    = await login(fields.email, fields.password)
      const profile = await hydrateProfile(cred.user)
      // hydrateProfile sets role in context; read it from the resolved value or wait
      // We re-fetch profile directly to get the role for immediate redirect
      const token = await cred.user.getIdToken()
      const res   = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { role } = await res.json()
        navigate(dashboardRoute(role), { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      // Intentionally non-specific — don't reveal whether the account exists
      setFormErr('Incorrect email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!fields.email.trim()) {
      setErrors(e => ({ ...e, email: 'Enter your email address above first.' }))
      document.getElementById(`${uid}-email`)?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      setErrors(e => ({ ...e, email: 'Enter a valid email address.' }))
      return
    }
    try {
      await resetPassword(fields.email)
      setResetSent(true)
    } catch {
      // Silently swallow — Firebase will not reveal whether the address exists
      setResetSent(true)
    }
  }

  return (
    <form
      className="auth-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Log in to Autara"
    >
      {/* Email */}
      <div className="field">
        <label htmlFor={`${uid}-email`}>Email address</label>
        <input
          id={`${uid}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={fields.email}
          onChange={e => set('email', e.target.value)}
          aria-describedby={errors.email ? `${uid}-email-err` : undefined}
          aria-invalid={!!errors.email}
          className={errors.email ? 'has-error' : ''}
          disabled={loading}
          placeholder="you@example.com"
        />
        <FieldError id={`${uid}-email-err`} message={errors.email} />
      </div>

      {/* Password */}
      <div className="field">
        <div className="field__label-row">
          <label htmlFor={`${uid}-password`}>Password</label>
          <button
            type="button"
            className="auth-form__link-btn"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            Forgot password?
          </button>
        </div>
        <div className="field__input-wrap">
          <input
            id={`${uid}-password`}
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            value={fields.password}
            onChange={e => set('password', e.target.value)}
            aria-describedby={errors.password ? `${uid}-password-err` : undefined}
            aria-invalid={!!errors.password}
            className={errors.password ? 'has-error' : ''}
            disabled={loading}
          />
          <button
            type="button"
            className="field__reveal-btn"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            onClick={() => setShowPwd(v => !v)}
          >
            {showPwd
              ? /* eye-off */
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              : /* eye */
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
            }
          </button>
        </div>
        <FieldError id={`${uid}-password-err`} message={errors.password} />
      </div>

      {/* Form-level error (auth failure) */}
      {formErr && (
        <div className="status-box status-box--error" role="alert">
          <svg className="status-box__icon" width="16" height="16" fill="none"
               stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{formErr}</span>
        </div>
      )}

      {/* Password reset confirmation */}
      {resetSent && (
        <div className="status-box status-box--ok" role="status">
          <svg className="status-box__icon" width="16" height="16" fill="none"
               stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.49 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
          </svg>
          <span>If an account exists for that address, a reset link is on its way.</span>
        </div>
      )}

      <button
        type="submit"
        id="login-submit-btn"
        className="btn btn--primary btn--full"
        disabled={loading}
      >
        {loading
          ? <><div className="spinner" aria-hidden="true" /><span>Signing in…</span></>
          : 'Log in'
        }
      </button>
    </form>
  )
}
