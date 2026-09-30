const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

/**
 * Firebase Admin SDK singleton initialisation (modular API — firebase-admin v14 removed the
 * old `admin.apps` / `admin.credential` / `admin.auth()` namespace).
 * Reads credentials from environment variables — no service account JSON committed.
 *
 * Required env vars (see backend/.env.example):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (with literal \n for newlines)
 *
 * Exports `{ auth }` so callers keep using `admin.auth().verifyIdToken(token)`.
 */
function app() {
  if (getApps().length) return getApp()
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace literal \n with real newlines (env vars don't preserve them)
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}

module.exports = { auth: () => getAuth(app()) }
