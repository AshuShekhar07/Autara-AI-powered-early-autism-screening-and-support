const express             = require('express')
const { signup, me, adminAccess } = require('../controllers/authController')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { ROLES }           = require('../utils/roles')

const router = express.Router()

/**
 * POST /api/auth/signup
 * Requires a Firebase ID token — uid/email are taken from the verified token.
 */
router.post('/signup', verifyFirebaseToken, signup)

/**
 * GET /api/auth/me
 * Returns the current user's role + verified status. Used by the frontend right
 * after login to pick the dashboard. Unverified clinical users are allowed here.
 */
router.get('/me', verifyFirebaseToken, requireRole(ROLES, { allowUnverified: true }), me)

/**
 * POST /api/auth/admin-access
 * Hidden admin login/sign-up. Only emails on ADMIN_EMAILS (backend/.env) get in.
 */
router.post('/admin-access', verifyFirebaseToken, adminAccess)

module.exports = router
