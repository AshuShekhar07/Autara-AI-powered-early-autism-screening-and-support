import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api } from '../lib/api'
import { clearSessionPrefix } from '../lib/safeStorage'

const AuthContext = createContext(null)

/**
 * Fetches the authenticated user's profile (role, verified, roleDetails) from the backend.
 * Returns null when the profile can't be loaded (e.g. signup never finished).
 */
let lastProfileError = null   // code of the last failed /me call, e.g. 'ACCOUNT_DISABLED'
async function fetchUserProfile() {
  try {
    const profile = await api.get('/api/auth/me') // { uid, name, email, role, verified, emailVerified, roleDetails }
    lastProfileError = null
    return profile
  } catch (err) {
    lastProfileError = err?.code || 'UNKNOWN_ERROR'
    return null
  }
}

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)  // Firebase user object
  const [role,        setRole]        = useState(null)  // 'caregiver' | 'patient' | 'therapist' | 'clinician' | 'admin'
  const [verified,    setVerified]    = useState(null)  // Boolean
  const [loading,     setLoading]     = useState(true)  // true until onAuthStateChanged first fires
  const [profileData, setProfileData] = useState(null)  // { name, email, emailVerified, roleDetails } from backend
  const [profileError, setProfileError] = useState(null) // e.g. 'ACCOUNT_DISABLED' when /me was refused

  const applyProfile = useCallback((profile) => {
    setProfileError(profile ? null : lastProfileError)
    if (profile) {
      setRole(profile.role)
      setVerified(profile.verified)
      setProfileData({
        name: profile.name, email: profile.email, emailVerified: profile.emailVerified !== false,
        roleDetails: profile.roleDetails || {},
      })
    } else {
      setRole(null)
      setVerified(null)
      setProfileData(null)
    }
  }, [])

  /* ── Listen for Firebase auth state ── */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        applyProfile(await fetchUserProfile())
      } else {
        setUser(null)
        lastProfileError = null
        applyProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [applyProfile])

  /* ── Actions ── */

  /** Signs in with email + password. Throws on failure (caller shows the message). */
  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  /**
   * Creates a new Firebase account. The caller (SignupForm) then POSTs the profile
   * to /api/auth/signup (the backend takes uid/email from the verified token).
   */
  async function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    clearSessionPrefix('autara.')   // unfinished screening / form drafts and the Ask conversation stay on this device only until log out
    await signOut(auth)
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
  }

  /**
   * (Re)loads role + verified from the backend and returns the profile
   * (or null). Used after login/signup and by the pending-verification page.
   */
  async function hydrateProfile() {
    const profile = await fetchUserProfile()
    applyProfile(profile)
    return profile
  }

  /** Emails a fresh "confirm your email" link to the signed-in user. */
  async function resendVerification() {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser)
  }

  /**
   * After the user clicked the link: reload the Firebase user, force a new token (it carries email_verified)
   * and re-read the profile. Returns true when the email is now confirmed.
   */
  async function refreshEmailVerified() {
    const current = auth.currentUser
    if (!current) return false
    await current.reload?.()
    await current.getIdToken(true)
    const profile = await hydrateProfile()
    return profile?.emailVerified === true
  }

  /** Permanently deletes the account (server side) and signs out. */
  async function deleteAccount() {
    await api.delete('/api/auth/me', { confirm: 'DELETE' })
    clearSessionPrefix('autara.')
    await signOut(auth).catch(() => {})
  }

  const value = {
    user, role, verified, loading, profileData, profileError,
    profileErrorCode: () => lastProfileError,   // synchronous: right after hydrateProfile() returned null
    login, signup, logout, resetPassword, hydrateProfile, resendVerification, refreshEmailVerified, deleteAccount,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/** Convenience hook — throws if used outside <AuthProvider> */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
