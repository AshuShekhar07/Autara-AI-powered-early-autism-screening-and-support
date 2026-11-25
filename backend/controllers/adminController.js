const User = require('../models/User')
const AuditLog = require('../models/AuditLog')
const firebaseAdmin = require('../lib/firebaseAdmin')
const { AppError, ok, asyncHandler } = require('../utils/respond')
const { requireBodyObject, cleanString, parseLimit } = require('../utils/validate')
const { ROLES, isClinicalRole } = require('../utils/roles')
const { audit } = require('../lib/audit')
const { computeAnalytics } = require('../lib/analytics')

/** Admin-facing user row. Child details (in roleDetails) are deliberately NOT exposed. */
function userRow(u) {
  const row = {
    uid: u.uid, name: u.name, email: u.email, role: u.role, verified: u.verified, createdAt: u.createdAt,
    emailVerified: u.emailVerified === true, disabled: u.disabled === true,
  }
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

/**
 * PATCH /api/admin/users/:uid/disabled { disabled: true|false } (audited)
 * A disabled user is refused on every route; their Firebase sign-in is switched off and signed out too.
 */
const setDisabled = asyncHandler(async (req, res) => {
  const { disabled } = requireBodyObject(req)
  if (typeof disabled !== 'boolean') throw new AppError(400, 'VALIDATION_ERROR', '"disabled" must be true or false.')
  const uid = cleanString(req.params.uid, { max: 128 })
  const user = uid && await User.findOne({ uid })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.')
  if (user.role === 'admin') {
    throw new AppError(400, 'CANNOT_DISABLE_ADMIN', 'Admins are switched off by taking their email off ADMIN_EMAILS.')
  }

  user.disabled = disabled
  await user.save()
  try {
    await firebaseAdmin.auth().updateUser(uid, { disabled })
    if (disabled) await firebaseAdmin.auth().revokeRefreshTokens(uid)
  } catch (err) {
    // the Autara flag above already blocks every request; Firebase is a second lock
    console.error('[admin] Firebase disable/enable failed:', err?.code)
  }
  await audit(req, disabled ? 'USER_DISABLED' : 'USER_ENABLED', { type: 'user', id: uid }, { role: user.role })
  return ok(res, { user: userRow(user.toObject()) })
})

/** GET /api/admin/audit?action=&page=&limit= — newest first. Rows hold ids and counts only (no child details). */
const auditLog = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.action !== undefined && req.query.action !== '') {
    const action = cleanString(req.query.action, { max: 64 })
    if (!action || !/^[A-Z_]+$/.test(action)) throw new AppError(400, 'VALIDATION_ERROR', 'Unknown action filter.')
    filter.action = action
  }
  const limit = parseLimit(req.query.limit, 50, 200)
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const [rows, total, actions] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct('action'),
  ])
  const people = await User.find({ uid: { $in: [...new Set(rows.map((r) => r.actorUid))] } }).select('uid name').lean()
  const names = Object.fromEntries(people.map((p) => [p.uid, p.name]))
  return ok(res, {
    entries: rows.map((r) => ({
      id: String(r._id), at: r.at, action: r.action, actorRole: r.actorRole,
      actorName: names[r.actorUid] || (r.actorUid === 'seed-script' ? 'Setup script' : 'Deleted / unknown user'),
      targetType: r.targetType, targetId: r.targetId, meta: r.meta || {},
    })),
    actions: actions.sort(), total, page, limit,
  })
})

module.exports = { listUsers, verifyUser, analytics, setDisabled, auditLog }
