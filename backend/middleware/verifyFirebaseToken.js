const admin = require('../lib/firebaseAdmin')

/**
 * verifyFirebaseToken middleware
 *
 * Reads the Bearer token from the Authorization header, verifies it
 * with the Firebase Admin SDK, and attaches the decoded token payload
 * to `req.firebaseUser`.
 *
 * Subsequent middleware / route handlers can read:
 *   req.firebaseUser.uid    — Firebase UID
 *   req.firebaseUser.email  — verified email from Firebase
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' })
  }

  const idToken = authHeader.slice(7) // strip "Bearer "

  try {
    const decoded = await admin.auth().verifyIdToken(idToken)
    req.firebaseUser = decoded
    next()
  } catch (err) {
    console.error('[verifyFirebaseToken] Token verification failed:', err.code)
    return res.status(401).json({ error: 'Invalid or expired authentication token.' })
  }
}

module.exports = verifyFirebaseToken
