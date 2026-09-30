const Child = require('../models/Child')
const User = require('../models/User')
const { AppError, ok, created, asyncHandler } = require('../utils/respond')
const { cleanString, parseDate, requireBodyObject } = require('../utils/validate')
const { isCareRole } = require('../utils/roles')
const { ageInMonths } = require('../utils/age')
const { audit } = require('../lib/audit')

const SEX_VALUES = ['female', 'male', 'other']

/** Public shape of a child (no internal flags). */
function childView(child, relation = 'owner') {
  const c = child.toObject ? child.toObject() : child
  return {
    id: String(c._id),
    name: c.name,
    dob: c.dob,
    ageMonths: ageInMonths(c.dob),
    sex: c.sex || null,
    careTeam: (c.careTeam || []).map((m) => ({ uid: m.uid, role: m.role, addedAt: m.addedAt })),
    relation,
    createdAt: c.createdAt,
  }
}

/**
 * Idempotent migration: a caregiver who signed up with roleDetails.childName
 * but has no Child document gets one created (once).
 */
async function ensureChildFromProfile(user) {
  const { childName, childDob } = user.roleDetails || {}
  if (!childName || !childDob) return
  if (await Child.exists({ caregiverUid: user.uid })) return
  // upsert on a marker keeps a double-click / concurrent call from creating two
  await Child.updateOne(
    { caregiverUid: user.uid, fromSignupProfile: true },
    { $setOnInsert: { name: childName, dob: new Date(childDob), fromSignupProfile: true, careTeam: [] } },
    { upsert: true }
  )
}

/** GET /api/children — caregiver/patient: their children. Clinical: their caseload. */
const listChildren = asyncHandler(async (req, res) => {
  const user = req.dbUser
  if (isCareRole(user.role)) {
    await ensureChildFromProfile(user)
    const children = await Child.find({ caregiverUid: user.uid }).sort({ createdAt: 1 })
    return ok(res, { children: children.map((c) => childView(c, 'owner')) })
  }
  const children = await Child.find({ 'careTeam.uid': user.uid }).sort({ name: 1 })
  return ok(res, { children: children.map((c) => childView(c, 'careTeam')) })
})

function parseChildFields(body, { partial }) {
  const out = {}
  if (!partial || body.name !== undefined) {
    const name = cleanString(body.name, { max: 120 })
    if (!name) throw new AppError(400, 'VALIDATION_ERROR', "Child's name is required.")
    out.name = name
  }
  if (!partial || body.dob !== undefined) {
    const dob = parseDate(body.dob)
    if (!dob || dob.getTime() > Date.now()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A valid date of birth (not in the future) is required.')
    }
    out.dob = dob
  }
  if (body.sex !== undefined) {
    if (body.sex !== null && !SEX_VALUES.includes(body.sex)) {
      throw new AppError(400, 'VALIDATION_ERROR', `sex must be one of: ${SEX_VALUES.join(', ')}.`)
    }
    out.sex = body.sex === null ? undefined : body.sex
  }
  return out
}

/** POST /api/children (caregiver / patient) */
const createChild = asyncHandler(async (req, res) => {
  const fields = parseChildFields(requireBodyObject(req), { partial: false })
  const child = await Child.create({ ...fields, caregiverUid: req.dbUser.uid })
  return created(res, { child: childView(child) })
})

/** GET /api/children/:id */
const getChild = asyncHandler(async (req, res) => {
  return ok(res, { child: childView(req.child, req.childRelation) })
})

/** PATCH /api/children/:id (owner only) */
const updateChild = asyncHandler(async (req, res) => {
  const fields = parseChildFields(requireBodyObject(req), { partial: true })
  Object.assign(req.child, fields)
  await req.child.save()
  return ok(res, { child: childView(req.child) })
})

/** Care-team members with display info (name, org) for the caregiver UI. */
async function hydrateCareTeam(child) {
  const uids = child.careTeam.map((m) => m.uid)
  const users = await User.find({ uid: { $in: uids } }).lean()
  const byUid = Object.fromEntries(users.map((u) => [u.uid, u]))
  return child.careTeam.map((m) => ({
    uid: m.uid,
    role: m.role,
    addedAt: m.addedAt,
    name: byUid[m.uid]?.name || 'Unknown',
    orgName: byUid[m.uid]?.roleDetails?.orgName || null,
  }))
}

/** GET /api/children/:id/care-team */
const getCareTeam = asyncHandler(async (req, res) => {
  return ok(res, { careTeam: await hydrateCareTeam(req.child) })
})

/** POST /api/children/:id/care-team { email } (owner only) */
const addCareTeamMember = asyncHandler(async (req, res) => {
  const email = cleanString(requireBodyObject(req).email, { max: 254 })?.toLowerCase()
  if (!email) throw new AppError(400, 'VALIDATION_ERROR', 'A professional email address is required.')

  const pro = await User.findOne({ email, verified: true, role: { $in: ['therapist', 'clinician'] } }).lean()
  if (!pro) {
    // Same message whether the email is unknown, unverified or not a professional.
    throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'No verified professional found with that email address.')
  }
  if (req.child.careTeam.some((m) => m.uid === pro.uid)) {
    throw new AppError(409, 'ALREADY_ON_CARE_TEAM', 'That professional is already on the care team.')
  }

  req.child.careTeam.push({ uid: pro.uid, role: pro.role })
  await req.child.save()
  await audit(req, 'CARE_TEAM_ADDED', { type: 'child', id: req.child._id }, { memberUid: pro.uid, role: pro.role })

  return created(res, { careTeam: await hydrateCareTeam(req.child) })
})

/** DELETE /api/children/:id/care-team/:uid (owner only) */
const removeCareTeamMember = asyncHandler(async (req, res) => {
  const { uid } = req.params
  const before = req.child.careTeam.length
  req.child.careTeam = req.child.careTeam.filter((m) => m.uid !== uid)
  if (req.child.careTeam.length === before) {
    throw new AppError(404, 'CARE_TEAM_MEMBER_NOT_FOUND', 'That person is not on the care team.')
  }
  await req.child.save()
  await audit(req, 'CARE_TEAM_REMOVED', { type: 'child', id: req.child._id }, { memberUid: uid })
  return ok(res, { careTeam: await hydrateCareTeam(req.child) })
})

/** GET /api/me/caseload — verified therapist / clinician: their assigned children. */
const caseload = asyncHandler(async (req, res) => {
  const children = await Child.find({ 'careTeam.uid': req.dbUser.uid }).sort({ name: 1 })
  return ok(res, {
    children: children.map((c) => ({
      id: String(c._id),
      name: c.name,
      ageMonths: ageInMonths(c.dob),
      myRole: c.careTeam.find((m) => m.uid === req.dbUser.uid)?.role || req.dbUser.role,
    })),
  })
})

module.exports = {
  listChildren, createChild, getChild, updateChild,
  getCareTeam, addCareTeamMember, removeCareTeamMember, caseload,
  childView,
}
