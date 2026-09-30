const User = require('../models/User')
const { AppError, asyncHandler } = require('../utils/respond')
const { isClinicalRole } = require('../utils/roles')

/**
 * requireRole(allowedRoles, options)
 *
 * Factory that returns a middleware enforcing role-based access control.
 * Role is always looked up from the database — never trusted from the client.
 *
 * Must be used AFTER verifyFirebaseToken (which populates req.firebaseUser).
 *
 * Clinical accounts (therapist / clinician) MUST be admin-verified. Unverified
 * ones get 403 ACCOUNT_NOT_VERIFIED on every route guarded by this middleware,
 * unless the route explicitly opts out with { allowUnverified: true }
 * (only /api/auth/me does, so the frontend can show "pending verification").
 *
 * @param {string[]} allowedRoles — e.g. ['caregiver', 'patient']
 * @param {{allowUnverified?: boolean}} [options]
 *
 * Usage:
 *   router.get('/protected', verifyFirebaseToken, requireRole(['admin']), handler)
 */
function requireRole(allowedRoles, { allowUnverified = false } = {}) {
  return asyncHandler(async function (req, _res, next) {
    if (!req.firebaseUser?.uid) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.')
    }

    const user = await User.findOne({ uid: req.firebaseUser.uid }).lean()
    if (!user) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'User profile not found. Please sign up first.')
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AppError(403, 'FORBIDDEN_ROLE', `Access denied. Required role: ${allowedRoles.join(' or ')}.`)
    }

    if (isClinicalRole(user.role) && !user.verified && !allowUnverified) {
      throw new AppError(403, 'ACCOUNT_NOT_VERIFIED', 'Your professional account is awaiting verification.')
    }

    // Attach full DB user for downstream handlers
    req.dbUser = user
    next()
  })
}

module.exports = requireRole
