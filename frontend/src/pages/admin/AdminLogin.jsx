import React, { useId, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signInWithEmailAndPassword, signOut,
} from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import '../auth/AuthPage.css'
import '../auth/AuthForms.css'

const NOT_ADMIN = "You're not an admin. This page is only for Autara administrators."

/**
 * Hidden admin login / first-time sign-up — /admin/login.
 *
 * Nothing in the app links here: parents, therapists and clinicians never see it. Being on this page gives no
 * power by itself — the backend only lets in emails listed in ADMIN_EMAILS (backend/.env) whose address has been
 * confirmed, and refuses everyone else with "You're not an admin".
 */
export default function AdminLogin() {
  const uid = useId()
  const navigate = useNavigate()
  const { user, role, loading: authLoading, hydrateProfile } = useAuth()
  const [mode, setMode] = useState('login')            // login | create
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (!authLoading && user && role === 'admin') return <Navigate to="/admin" replace />

  function switchMode(next) { setMode(next); setError(''); setInfo('') }

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    const addr = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError('Enter a valid email address.'); return }
    if (!password) { setError('Enter your password.'); return }
    if (mode === 'create') {
      if (password.length < 8) { setError('Use at least 8 characters for the password.'); return }
      if (password !== confirm) { setError('The two passwords do not match.'); return }
    }

    setBusy(true)
    let createdNow = false
    try {
      if (mode === 'create') {
        await createUserWithEmailAndPassword(auth, addr, password)
        createdNow = true
      } else {
        await signInWithEmailAndPassword(auth, addr, password)
      }
    } catch (err) {
      setBusy(false)
      if (err?.code === 'auth/email-already-in-use') setError('This email already has an account. Use "Log in" instead.')
      else if (err?.code === 'auth/weak-password') setError('Choose a stronger password (at least 8 characters).')
      else setError(mode === 'create' ? 'Could not create the account. Please try again.' : 'Incorrect email or password.')
      return
    }

    try {
      await api.post('/api/auth/admin-access', mode === 'create' ? { name: name.trim() } : {})
      await hydrateProfile()
      navigate('/admin', { replace: true })
    } catch (err) {
      const current = auth.currentUser
      if (err?.code === 'NOT_ADMIN') {
        // Don't leave behind a sign-in account for someone who was never allowed in.
        if (createdNow && current) await deleteUser(current).catch(() => {})
        setError(NOT_ADMIN)
      } else if (err?.code === 'EMAIL_NOT_VERIFIED') {
        if (current) await sendEmailVerification(current).catch(() => {})
        setInfo(`Almost done: we've emailed a confirmation link to ${addr}. Open it, then come back here and log in.`)
        setMode('login')
      } else {
        setError(err?.message || 'Something went wrong. Please try again.')
      }
      await signOut(auth).catch(() => {})
      setBusy(false)
    }
  }

  return (
    <main className="auth-page" id="main-content">
      <div className="auth-page__brand">
        <svg className="auth-page__logo-mark" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <rect width="44" height="44" rx="9" fill="#0A0F12" />
          <path d="M22 10c0 0-10 6-10 14a10 10 0 0 0 20 0C32 16 22 10 22 10z" fill="#14B8A6" />
          <path d="M22 14v18" stroke="#0A0F12" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="auth-page__wordmark">
          <h1 className="auth-page__name">Autara Admin</h1>
          <span className="auth-page__tagline">Restricted area</span>
        </div>
      </div>

      <section className="auth-card" aria-label={mode === 'login' ? 'Admin log in' : 'Create admin account'}>
        <p className="admin-login__note">
          Only Autara administrators can use this page. Parents and professionals: please use the normal{' '}
          <a href="/login">login page</a>.
        </p>

        <form className="auth-form" onSubmit={submit} noValidate
              aria-label={mode === 'login' ? 'Admin log in' : 'Create admin account'}>
          {mode === 'create' && (
            <div className="field">
              <label htmlFor={`${uid}-name`}>Full name</label>
              <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={busy} />
            </div>
          )}
          <div className="field">
            <label htmlFor={`${uid}-email`}>Admin email</label>
            <input id={`${uid}-email`} type="email" inputMode="email" autoComplete="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-pw`}>Password</label>
            <input id={`${uid}-pw`} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                   value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </div>
          {mode === 'create' && (
            <div className="field">
              <label htmlFor={`${uid}-pw2`}>Confirm password</label>
              <input id={`${uid}-pw2`} type="password" autoComplete="new-password" value={confirm}
                     onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
            </div>
          )}

          {error && <div className="status-box status-box--error" role="alert">{error}</div>}
          {info && <div className="status-box status-box--ok" role="status">{info}</div>}

          <button type="submit" className="btn btn--primary btn--full" disabled={busy} aria-busy={busy}>
            {busy ? 'Checking…' : mode === 'login' ? 'Log in to admin panel' : 'Create admin account'}
          </button>
        </form>

        <p className="admin-login__switch">
          {mode === 'login'
            ? <>First time here? <button type="button" className="auth-page__switch-btn" onClick={() => switchMode('create')}>Create your admin account</button></>
            : <>Already have an admin account? <button type="button" className="auth-page__switch-btn" onClick={() => switchMode('login')}>Log in</button></>}
        </p>
      </section>
    </main>
  )
}
