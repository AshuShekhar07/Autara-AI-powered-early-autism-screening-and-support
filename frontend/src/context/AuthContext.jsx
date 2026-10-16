import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api } from '../lib/api'

const AuthContext = createContext(null)

/**
 * Fetches the authenticated user's profile (role, verified, roleDetails) from the backend.
 * Returns null when the profile can't be loaded (e.g. signup never finished).
 */
async function fetchUserProfile() {
  try {
    return await api.get('/api/auth/me') // { uid, name, email, role, verified, roleDetails }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)  // Firebase user object
  const [role,        setRole]        = useState(null)  // 'caregiver' | 'patient' | 'therapist' | 'clinician' | 'admin'
  const [verified,    setVerified]    = useState(null)  // Boolean
  const [loading,     setLoading]     = useState(true)  // true until onAuthStateChanged first fires
  const [profileData, setProfileData] = useState(null)  // { name, roleDetails } from backend

  const applyProfile = useCallback((profile) => {
    if (profile) {
      setRole(profile.role)
      setVerified(profile.verified)
      setProfileData({ name: profile.name, email: profile.email, roleDetails: profile.roleDetails || {} })
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

  const value = { user, role, verified, loading, profileData, login, signup, logout, resetPassword, hydrateProfile }

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
