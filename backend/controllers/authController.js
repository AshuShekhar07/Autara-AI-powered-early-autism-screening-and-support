const User = require('../models/User')
const { AppError, ok, created, asyncHandler } = require('../utils/respond')
const { cleanString, parseDate, requireBodyObject } = require('../utils/validate')
const { isCareRole } = require('../utils/roles')

const SIGNUP_ROLES = ['caregiver', 'patient', 'therapist', 'clinician'] // admin is never self-service

/** Builds the sanitised roleDetails object for a role, or throws 400. */
function buildRoleDetails(role, raw) {
  const details = raw && typeof raw === 'object' ? raw : {}

  if (isCareRole(role)) {
    const childName = cleanString(details.childName, { max: 120 })
    const dob = parseDate(details.childDob)
    if (!childName) throw new AppError(400, 'VALIDATION_ERROR', "Child's name is required.")
    if (!dob || dob.getTime() > Date.now()) {
      throw new AppError(400, 'VALIDATION_ERROR', "A valid child date of birth (not in the future) is required.")
    }
    return { childName, childDob: dob.toISOString().slice(0, 10) }
  }

  const orgName = cleanString(details.orgName, { max: 160 })
  const licenseNumber = cleanString(details.licenseNumber, { max: 80 })
  if (!orgName || !licenseNumber) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Organisation name and licence number are required.')
  }
  return { orgName, licenseNumber }
}

/**
 * POST /api/auth/signup   (requires a valid Firebase ID token)
 *
 * Creates the User document for a Firebase account that was just created.
 * SECURITY: `uid` and `email` come ONLY from the verified token — never from
 * the request body — so nobody can create a profile for someone else's UID.
 *
 * Body: { name, role, roleDetails }
 */
const signup = asyncHandler(async (req, res) => {
  const body = requireBodyObject(req)
  const uid = req.firebaseUser.uid
  const email = (req.firebaseUser.email || '').toLowerCase()

  if (!email) throw new AppError(400, 'VALIDATION_ERROR', 'Your Firebase account has no email address.')

  const name = cleanString(body.name, { max: 120 })
  if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Name is required.')

  if (!SIGNUP_ROLES.includes(body.role)) {
    throw new AppError(400, 'INVALID_ROLE', `Invalid role. Must be one of: ${SIGNUP_ROLES.join(', ')}.`)
  }
  const roleDetails = buildRoleDetails(body.role, body.roleDetails)

  const existing = await User.findOne({ $or: [{ uid }, { email }] }).lean()
  if (existing) {
    throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email or UID already exists.')
  }

  const user = await User.create({ uid, name, email, role: body.role, roleDetails })

  return created(res, {
    uid: user.uid,
    role: user.role,
    verified: user.verified,
  })
})

/**
 * GET /api/auth/me
 *
 * Returns the current user's profile. Available to unverified clinical
 * accounts too (the frontend needs `verified: false` to show the pending page).
 */
const me = asyncHandler(async (req, res) => {
  const user = req.dbUser
  return ok(res, {
    uid:      user.uid,
    name:     user.name,
    email:    user.email,
    role:     user.role,
    verified: user.verified,
    // Caregiver / patient: { childName, childDob }. Clinical: { orgName, licenseNumber }.
    roleDetails: user.roleDetails || {},
  })
})

module.exports = { signup, me }
