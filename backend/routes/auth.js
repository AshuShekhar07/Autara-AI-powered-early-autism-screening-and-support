const express              = require('express')
const { signup, me }       = require('../controllers/authController')
const verifyFirebaseToken  = require('../middleware/verifyFirebaseToken')

const router = express.Router()

/**
 * POST /api/auth/signup
 * Public — creates the User document after Firebase account creation.
 * The Firebase ID token is optionally sent for logging but not used for the uid field.
 */
router.post('/signup', signup)

/**
 * GET /api/auth/me
 * Protected — returns the current user's role + verified status.
 * Used by the frontend right after login to decide which dashboard to redirect to.
 */
router.get('/me', verifyFirebaseToken, me)

module.exports = router
