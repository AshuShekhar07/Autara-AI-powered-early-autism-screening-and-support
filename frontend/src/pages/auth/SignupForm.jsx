import React, { useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import RoleSelector from '../../components/auth/RoleSelector'
import './AuthForms.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/* ── Inline field error ── */
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
function validate(fields) {
  const errs = {}
  if (!fields.name.trim())
    errs.name = 'Full name is required.'

  if (!fields.email.trim())
    errs.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errs.email = 'Enter a valid email address.'

  if (!fields.password)
    errs.password = 'Password is required.'
  else if (fields.password.length < 8)
    errs.password = 'Password must be at least 8 characters.'

  if (!fields.confirmPassword)
    errs.confirmPassword = 'Please confirm your password.'
  else if (fields.password && fields.password !== fields.confirmPassword)
    errs.confirmPassword = 'Passwords do not match.'

  // Role-specific
  if (fields.role === 'caregiver' || fields.role === 'patient') {
    if (!fields.childName.trim())
      errs.childName = "Child's name is required."
    if (!fields.childDob)
      errs.childDob  = "Child's date of birth is required."
  }
  if (fields.role === 'therapist' || fields.role === 'clinician') {
    if (!fields.orgName.trim())
      errs.orgName    = 'Organisation or clinic name is required.'
    if (!fields.licenseNumber.trim())
      errs.licenseNumber = 'Professional licence number is required.'
  }

  return errs
}

/* ── Role categories ── */
const isCareRole     = r => r === 'caregiver' || r === 'patient'
const isClinicalRole = r => r === 'therapist' || r === 'clinician'

export default function SignupForm() {
  const uid      = useId()
  const navigate = useNavigate()
  const { signup, hydrateProfile } = useAuth()

  const [role, setRole] = useState('caregiver')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)  // true once backend call succeeds
  const [formErr, setFormErr] = useState('')

  const [fields, setFields] = useState({
    name:           '',
    email:          '',
    password:       '',
    confirmPassword:'',
    // Caregiver / patient extras
    childName:      '',
    childDob:       '',
    // Clinical extras
    orgName:        '',
    licenseNumber:  '',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setFields(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
    if (formErr)     setFormErr('')
  }

  function handleRoleChange(newRole) {
    setRole(newRole)
    // Clear role-specific errors when switching
    setErrors(e => {
      const next = { ...e }
      delete next.childName; delete next.childDob
      delete next.orgName;   delete next.licenseNumber
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fullFields = { ...fields, role }
    const errs = validate(fullFields)
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setFormErr('')

    try {
      // 1. Create Firebase account
      const cred = await signup(fields.email, fields.password)
      const token = await cred.user.getIdToken()

      // 2. Build role details payload
      const roleDetails = isCareRole(role)
        ? { childName: fields.childName, childDob: fields.childDob }
        : { orgName: fields.orgName, licenseNumber: fields.licenseNumber }

      // 3. POST profile to backend
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // We include the token so the backend can optionally verify it
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid:         cred.user.uid,
          name:        fields.name,
          email:       fields.email,
          role,
          roleDetails,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Account creation failed. Please try again.')
      }

      // 4. Hydrate auth context
      await hydrateProfile(cred.user)

      setSuccess(true)

      // Auto-redirect only for immediately-verified roles
      if (isCareRole(role)) {
        setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
      }
    } catch (err) {
      // Firebase duplicate-email error code
      if (err.code === 'auth/email-already-in-use') {
        setErrors(ev => ({ ...ev, email: 'An account with this email already exists.' }))
      } else {
        setFormErr(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div className="auth-form auth-form--success" aria-live="polite">
        {isClinicalRole(role) ? (
          <div className="status-box status-box--notice success-notice">
            <svg className="status-box__icon" width="20" height="20" fill="none"
                 stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div>
              <strong>Account created — pending verification</strong>
              <p style={{ marginTop: 4 }}>
                Your {role} account has been submitted. Our team will review your
                credentials and send a confirmation email within 1–2 business days.
                You'll have full access once your account is verified.
              </p>
            </div>
          </div>
        ) : (
          <div className="status-box status-box--ok success-notice">
            <svg className="status-box__icon" width="20" height="20" fill="none"
                 stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div>
              <strong>Welcome to Autara!</strong>
              <p style={{ marginTop: 4 }}>Your account is ready. Redirecting you to the dashboard…</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <form
      className="auth-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create an Autara account"
    >
      {/* Role selector */}
      <RoleSelector value={role} onChange={handleRoleChange} />

      {/* Full name */}
      <div className="field">
        <label htmlFor={`${uid}-name`}>Full name</label>
        <input
          id={`${uid}-name`}
          type="text"
          autoComplete="name"
          value={fields.name}
          onChange={e => set('name', e.target.value)}
          aria-describedby={errors.name ? `${uid}-name-err` : undefined}
          aria-invalid={!!errors.name}
          className={errors.name ? 'has-error' : ''}
          disabled={loading}
          placeholder="Jane Smith"
        />
        <FieldError id={`${uid}-name-err`} message={errors.name} />
      </div>

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
        <label htmlFor={`${uid}-password`}>Password</label>
        <div className="field__input-wrap">
          <input
            id={`${uid}-password`}
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            value={fields.password}
            onChange={e => set('password', e.target.value)}
            aria-describedby={`${uid}-password-hint${errors.password ? ` ${uid}-password-err` : ''}`}
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
              ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
            }
          </button>
        </div>
        <span id={`${uid}-password-hint`} className="field__hint">Minimum 8 characters</span>
        <FieldError id={`${uid}-password-err`} message={errors.password} />
      </div>

      {/* Confirm password */}
      <div className="field">
        <label htmlFor={`${uid}-confirm`}>Confirm password</label>
        <input
          id={`${uid}-confirm`}
          type={showPwd ? 'text' : 'password'}
          autoComplete="new-password"
          value={fields.confirmPassword}
          onChange={e => set('confirmPassword', e.target.value)}
          aria-describedby={errors.confirmPassword ? `${uid}-confirm-err` : undefined}
          aria-invalid={!!errors.confirmPassword}
          className={errors.confirmPassword ? 'has-error' : ''}
          disabled={loading}
        />
        <FieldError id={`${uid}-confirm-err`} message={errors.confirmPassword} />
      </div>

      {/* ── Role-specific fields — animated reveal ── */}

      {/* Caregiver / Patient extras */}
      <div
        className={`role-fields${isCareRole(role) ? ' role-fields--visible' : ''}`}
        aria-hidden={!isCareRole(role)}
      >
        <div className="field">
          <label htmlFor={`${uid}-child-name`}>Child's name</label>
          <input
            id={`${uid}-child-name`}
            type="text"
            autoComplete="off"
            value={fields.childName}
            onChange={e => set('childName', e.target.value)}
            aria-describedby={errors.childName ? `${uid}-child-name-err` : undefined}
            aria-invalid={!!errors.childName}
            className={errors.childName ? 'has-error' : ''}
            disabled={loading || !isCareRole(role)}
            tabIndex={isCareRole(role) ? 0 : -1}
            placeholder="Alex"
          />
          <FieldError id={`${uid}-child-name-err`} message={errors.childName} />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-child-dob`}>Child's date of birth</label>
          <input
            id={`${uid}-child-dob`}
            type="date"
            value={fields.childDob}
            onChange={e => set('childDob', e.target.value)}
            aria-describedby={errors.childDob ? `${uid}-child-dob-err` : undefined}
            aria-invalid={!!errors.childDob}
            className={errors.childDob ? 'has-error' : ''}
            disabled={loading || !isCareRole(role)}
            tabIndex={isCareRole(role) ? 0 : -1}
            max={new Date().toISOString().split('T')[0]}
          />
          <FieldError id={`${uid}-child-dob-err`} message={errors.childDob} />
        </div>
      </div>

      {/* Therapist / Clinician extras */}
      <div
        className={`role-fields${isClinicalRole(role) ? ' role-fields--visible' : ''}`}
        aria-hidden={!isClinicalRole(role)}
      >
        <div className="field">
          <label htmlFor={`${uid}-org`}>Organisation / clinic name</label>
          <input
            id={`${uid}-org`}
            type="text"
            autoComplete="organization"
            value={fields.orgName}
            onChange={e => set('orgName', e.target.value)}
            aria-describedby={errors.orgName ? `${uid}-org-err` : undefined}
            aria-invalid={!!errors.orgName}
            className={errors.orgName ? 'has-error' : ''}
            disabled={loading || !isClinicalRole(role)}
            tabIndex={isClinicalRole(role) ? 0 : -1}
            placeholder="Sunridge Children's Clinic"
          />
          <FieldError id={`${uid}-org-err`} message={errors.orgName} />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-license`}>Professional licence / registration number</label>
          <input
            id={`${uid}-license`}
            type="text"
            autoComplete="off"
            value={fields.licenseNumber}
            onChange={e => set('licenseNumber', e.target.value)}
            aria-describedby={`${uid}-license-hint${errors.licenseNumber ? ` ${uid}-license-err` : ''}`}
            aria-invalid={!!errors.licenseNumber}
            className={errors.licenseNumber ? 'has-error' : ''}
            disabled={loading || !isClinicalRole(role)}
            tabIndex={isClinicalRole(role) ? 0 : -1}
            placeholder="e.g. HCPC-ST-12345"
          />
          <span id={`${uid}-license-hint`} className="field__hint">
            This will be verified by our clinical team before your account is activated.
          </span>
          <FieldError id={`${uid}-license-err`} message={errors.licenseNumber} />
        </div>
      </div>

      {/* Form-level error */}
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

      <button
        type="submit"
        id="signup-submit-btn"
        className="btn btn--primary btn--full"
        disabled={loading}
      >
        {loading
          ? <><div className="spinner" aria-hidden="true" /><span>Creating account…</span></>
          : 'Create account'
        }
      </button>

      <p className="auth-form__legal">
        By creating an account you agree to our{' '}
        <a href="/terms">Terms of Service</a> and{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  )
}
