const admin = require('firebase-admin')

/**
 * Firebase Admin SDK singleton initialisation.
 * Reads credentials from environment variables — no service account JSON committed.
 *
 * Required env vars (see backend/.env.example):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (with literal \n for newlines)
 */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace literal \n with real newlines (env vars don't preserve them)
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}

module.exports = admin
