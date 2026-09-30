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

  try {
    req.firebaseUser = await admin.auth().verifyIdToken(idToken)
  } catch (err) {
    console.error('[verifyFirebaseToken] Token verification failed:', err.code)
    throw new AppError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired authentication token.')
  }
  next()
})

module.exports = verifyFirebaseToken
