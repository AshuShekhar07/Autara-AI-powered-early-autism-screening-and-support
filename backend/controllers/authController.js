const User = require('../models/User')

/**
 * POST /api/auth/signup
 *
 * Called by the frontend immediately after Firebase creates the user account.
 * Creates the corresponding User document in MongoDB.
 *
 * Body: { uid, name, email, role, roleDetails }
 * No auth middleware on this route — the Firebase UID is the primary key
 * and the ID token is included for optional logging, not trusted for the uid field.
 */
async function signup(req, res) {
  const { uid, name, email, role, roleDetails } = req.body

  // Basic server-side validation
  if (!uid || !name || !email || !role) {
    return res.status(400).json({ error: 'uid, name, email, and role are required.' })
  }

  const VALID_ROLES = ['caregiver', 'patient', 'therapist', 'clinician']
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` })
  }

  // Prevent duplicate registrations
  const existing = await User.findOne({ $or: [{ uid }, { email: email.toLowerCase() }] })
  if (existing) {
    return res.status(409).json({ error: 'An account with this email or UID already exists.' })
  }

  try {
    const user = await User.create({ uid, name, email, role, roleDetails: roleDetails || {} })

    return res.status(201).json({
      message:  'Account created successfully.',
      uid:      user.uid,
      role:     user.role,
      verified: user.verified,
    })
  } catch (err) {
    // Mongoose duplicate key
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' })
    }
    console.error('[signup] DB error:', err)
    return res.status(500).json({ error: 'Failed to create user profile. Please try again.' })
  }
}

/**
 * GET /api/auth/me
 *
 * Returns the current user's profile from MongoDB.
 * Requires verifyFirebaseToken middleware (populates req.firebaseUser).
 *
 * Response: { uid, name, email, role, verified }
 */
async function me(req, res) {
  try {
    const user = await User.findOne({ uid: req.firebaseUser.uid }).lean()

    if (!user) {
      return res.status(404).json({ error: 'User profile not found. Please sign up first.' })
    }

    return res.json({
      uid:         user.uid,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      verified:    user.verified,
      // roleDetails is a Mixed field. For caregivers/patients it holds
      // { childName, childDob }. For therapists/clinicians it holds
      // { orgName, licenseNumber }. Sending it here avoids a separate
      // profile API call on the frontend.
      roleDetails: user.roleDetails || {},
    })
  } catch (err) {
    console.error('[me] DB error:', err)
    return res.status(500).json({ error: 'Failed to retrieve user profile.' })
  }
}

module.exports = { signup, me }
