const User = require('../models/User')

/**
 * requireRole(allowedRoles)
 *
 * Factory that returns a middleware enforcing role-based access control.
 * Role is always looked up from the database — never trusted from the client.
 *
 * Must be used AFTER verifyFirebaseToken (which populates req.firebaseUser).
 *
 * @param {string[]} allowedRoles — e.g. ['caregiver', 'patient']
 *
 * Usage:
 *   router.get('/protected', verifyFirebaseToken, requireRole(['admin']), handler)
 */
function requireRole(allowedRoles) {
  return async function (req, res, next) {
    if (!req.firebaseUser?.uid) {
      return res.status(401).json({ error: 'Authentication required.' })
    }

    try {
      const user = await User.findOne({ uid: req.firebaseUser.uid }).lean()

      if (!user) {
        return res.status(404).json({ error: 'User profile not found.' })
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
        })
      }

      // Attach full DB user for downstream handlers
      req.dbUser = user
      next()
    } catch (err) {
      console.error('[requireRole] DB lookup failed:', err)
      res.status(500).json({ error: 'Internal server error.' })
    }
  }
}

module.exports = requireRole
