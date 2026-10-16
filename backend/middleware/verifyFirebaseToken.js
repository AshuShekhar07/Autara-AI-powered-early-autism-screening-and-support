const admin = require('../lib/firebaseAdmin')
const { AppError, asyncHandler } = require('../utils/respond')

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
const verifyFirebaseToken = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Missing or malformed Authorization header.')
  }

  const idToken = authHeader.slice(7) // strip "Bearer "

  // AUTH_CHECK_REVOKED=true also asks Firebase whether the session was revoked or the account disabled/deleted
  // (one extra Firebase lookup per request; recommended for a deployed instance, see backend/.env.example).
  const checkRevoked = process.env.AUTH_CHECK_REVOKED === 'true'

  try {
    req.firebaseUser = await admin.auth().verifyIdToken(idToken, checkRevoked)
  } catch (err) {
    console.error('[verifyFirebaseToken] Token verification failed:', err.code)
    const message = {
      'auth/id-token-expired': 'Your session has expired. Please sign in again.',
      'auth/id-token-revoked': 'Your session is no longer valid. Please sign in again.',
      'auth/user-disabled': 'This account has been disabled.',
    }[err.code] || 'Invalid or expired authentication token.'
    throw new AppError(401, 'AUTH_INVALID_TOKEN', message)
  }
  next()
})

module.exports = verifyFirebaseToken
