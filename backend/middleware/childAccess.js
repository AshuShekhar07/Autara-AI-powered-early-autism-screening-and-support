const Child = require('../models/Child')
const { AppError, asyncHandler } = require('../utils/respond')
const { isObjectId } = require('../utils/validate')
const { isCareRole, isClinicalRole } = require('../utils/roles')

const NOT_FOUND = () => new AppError(404, 'CHILD_NOT_FOUND', 'Child not found.')

/**
 * Loads a child and checks the requesting user may see it.
 *
 *  - caregiver / patient : only children where caregiverUid === their uid
 *  - therapist / clinician: only children where they are in careTeam AND verified
 *  - admin               : never (aggregates only) → 403
 *
 * Every "no" for a non-admin is the same 404, so the API never reveals
 * whether a child with a given id exists.
 *
 * @returns {Promise<{child: object, relation: 'owner'|'careTeam'}>}
 */
async function getAccessibleChild(user, childId) {
  if (user.role === 'admin') {
    throw new AppError(403, 'ADMIN_NO_CHILD_ACCESS', 'Administrators can view aggregate data only.')
  }
  if (!isObjectId(childId)) throw NOT_FOUND()

  const child = await Child.findById(childId)
  if (!child) throw NOT_FOUND()

  if (isCareRole(user.role)) {
    if (child.caregiverUid !== user.uid) throw NOT_FOUND()
    return { child, relation: 'owner' }
  }

  if (isClinicalRole(user.role)) {
    const onTeam = user.verified && child.careTeam.some((m) => m.uid === user.uid)
    if (!onTeam) throw NOT_FOUND()
    return { child, relation: 'careTeam' }
  }

  throw NOT_FOUND()
}

/**
 * Express middleware: reads the child id from req.params[param], attaches
 * req.child (mongoose doc) and req.childRelation. Use after requireRole.
 */
function childAccess(param = 'id') {
  return asyncHandler(async (req, _res, next) => {
    const { child, relation } = await getAccessibleChild(req.dbUser, req.params[param])
    req.child = child
    req.childRelation = relation
    next()
  })
}

/** Use after childAccess() on routes only the owning caregiver/patient may call. */
function requireChildOwner(req, _res, next) {
  if (req.childRelation !== 'owner') {
    return next(new AppError(403, 'OWNER_ONLY', 'Only the child\'s caregiver can do this.'))
  }
  next()
}

module.exports = { childAccess, getAccessibleChild, requireChildOwner }
