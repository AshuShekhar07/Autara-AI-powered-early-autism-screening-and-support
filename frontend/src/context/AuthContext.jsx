import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

const AuthContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Fetches the authenticated user's role and verified status from the backend.
 * Sends the Firebase ID token in the Authorization header.
 */
async function fetchUserProfile(firebaseUser) {
  try {
    const token = await firebaseUser.getIdToken()
    const res   = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json() // { name, role, roleDetails, verified }
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

  /* ── Listen for Firebase auth state ── */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        const profile = await fetchUserProfile(firebaseUser)
        if (profile) {
          setRole(profile.role)
          setVerified(profile.verified)
          setProfileData({ name: profile.name, roleDetails: profile.roleDetails || {} })
        }
      } else {
        setUser(null)
        setRole(null)
        setVerified(null)
        setProfileData(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  /* ── Actions ── */

  /**
   * Signs in an existing user with email + password.
   * Returns the Firebase UserCredential on success.
   * Throws on failure (caller handles the error message).
   */
  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    // Profile hydration happens automatically via onAuthStateChanged
    return cred
  }

  /**
   * Creates a new Firebase account. The caller (SignupForm) is responsible
   * for POSTing the user profile to /api/auth/signup after this resolves.
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
   * Manually hydrates role + verified after the backend profile is created
   * (called by SignupForm right after the POST /api/auth/signup succeeds).
   */
  async function hydrateProfile(firebaseUser) {
    const profile = await fetchUserProfile(firebaseUser)
    if (profile) {
      setRole(profile.role)
      setVerified(profile.verified)
      setProfileData({ name: profile.name, roleDetails: profile.roleDetails || {} })
    }
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
