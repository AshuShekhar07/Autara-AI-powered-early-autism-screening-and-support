const { AppError, ok, asyncHandler } = require('../utils/respond')
const { requireBodyObject } = require('../utils/validate')

const CATEGORIES = ['language', 'social', 'motor', 'cognitive', 'adaptive']
const STATUSES = ['not_reviewed', 'in_progress', 'reviewed']

function view(child) {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 'not_reviewed']))
  for (const [k, v] of child.milestones || []) if (CATEGORIES.includes(k)) out[k] = v
  return out
}

/** GET /api/children/:id/milestones → { statuses: { language: 'reviewed', ... } } */
const getMilestones = asyncHandler(async (req, res) => ok(res, { statuses: view(req.child) }))

/** PUT /api/children/:id/milestones { statuses: { category: status } } (owner only; merges) */
const putMilestones = asyncHandler(async (req, res) => {
  const { statuses } = requireBodyObject(req)
  if (!statuses || typeof statuses !== 'object' || Array.isArray(statuses)) {
    throw new AppError(400, 'VALIDATION_ERROR', '"statuses" must be an object.')
  }
  for (const [k, v] of Object.entries(statuses)) {
    if (!CATEGORIES.includes(k)) throw new AppError(400, 'VALIDATION_ERROR', `Unknown milestone category "${k}".`)
    if (!STATUSES.includes(v)) throw new AppError(400, 'VALIDATION_ERROR', `Status must be one of: ${STATUSES.join(', ')}.`)
    req.child.milestones.set(k, v)
  }
  await req.child.save()
  return ok(res, { statuses: view(req.child) })
})

module.exports = { getMilestones, putMilestones, CATEGORIES, STATUSES }
