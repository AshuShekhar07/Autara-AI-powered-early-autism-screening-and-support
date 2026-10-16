const User = require('../models/User')
const { AppError, ok, asyncHandler } = require('../utils/respond')
const { requireBodyObject, cleanString, parseLimit } = require('../utils/validate')
const { ROLES, isClinicalRole } = require('../utils/roles')
const { audit } = require('../lib/audit')
const { computeAnalytics } = require('../lib/analytics')

/** Admin-facing user row. Child details (in roleDetails) are deliberately NOT exposed. */
function userRow(u) {
  const row = { uid: u.uid, name: u.name, email: u.email, role: u.role, verified: u.verified, createdAt: u.createdAt }
  if (isClinicalRole(u.role)) {
    row.verificationStatus = u.verificationStatus || (u.verified ? 'approved' : 'pending')
    row.orgName = u.roleDetails?.orgName || null
    row.licenseNumber = u.roleDetails?.licenseNumber || null
  }
  return row
}

/** GET /api/admin/users?role=&verified=&status=pending|approved|rejected&page=&limit= */
const listUsers = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.role !== undefined) {
    if (!ROLES.includes(req.query.role)) throw new AppError(400, 'VALIDATION_ERROR', 'Unknown role filter.')
    filter.role = req.query.role
  }
  if (req.query.verified !== undefined) {
    if (!['true', 'false'].includes(req.query.verified)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'verified must be "true" or "false".')
    }
    filter.verified = req.query.verified === 'true'
  }
  if (req.query.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(req.query.status)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'status must be pending, approved or rejected.')
    }
    // accounts created before this field existed have no status: treat "no status" as pending/approved by `verified`
    if (req.query.status === 'pending') Object.assign(filter, { verified: false, verificationStatus: { $ne: 'rejected' } })
    else if (req.query.status === 'approved') filter.verified = true
    else filter.verificationStatus = 'rejected'
    filter.role = filter.role || { $in: ['therapist', 'clinician'] }
  }
  const limit = parseLimit(req.query.limit, 50, 200)
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ])
  return ok(res, { users: users.map(userRow), total, page, limit })
})

/** PATCH /api/admin/users/:uid/verify { verified: true|false } (audited) */
const verifyUser = asyncHandler(async (req, res) => {
  const { verified } = requireBodyObject(req)
  if (typeof verified !== 'boolean') {
    throw new AppError(400, 'VALIDATION_ERROR', '"verified" must be true or false.')
  }
  const uid = cleanString(req.params.uid, { max: 128 })
  const user = uid && await User.findOne({ uid })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.')
  if (!isClinicalRole(user.role)) {
    throw new AppError(400, 'NOT_A_CLINICAL_ACCOUNT', 'Only therapist and clinician accounts need verification.')
  }

  user.verified = verified
  user.verificationStatus = verified ? 'approved' : 'rejected'
  await user.save()
  await audit(req, verified ? 'USER_VERIFIED' : 'USER_VERIFICATION_REVOKED',
    { type: 'user', id: user.uid }, { role: user.role })

  return ok(res, { user: userRow(user.toObject()) })
})

/** GET /api/admin/analytics — anonymised aggregates only (k-anonymity, k = 5). */
const analytics = asyncHandler(async (_req, res) => ok(res, { analytics: await computeAnalytics() }))

module.exports = { listUsers, verifyUser, analytics }
