const Screening = require('../models/Screening')
const aiClient = require('../lib/aiClient')
const { getAccessibleChild } = require('../middleware/childAccess')
const { AppError, ok, asyncHandler } = require('../utils/respond')
const { requireBodyObject, cleanString, isObjectId } = require('../utils/validate')
const { DISCLAIMER } = require('../lib/disclaimer')

/**
 * Child context for Ask Autara: ONLY the latest REVIEWED screening's effective tier, the flagged
 * areas and the age in months. No name, no dates, no answers, no logs.
 */
async function childContext(user, childId) {
  await getAccessibleChild(user, childId) // caregiver must own the child, else 404
  const s = await Screening.findOne({ childId, status: 'REVIEWED' }).sort({ createdAt: -1 })
  if (!s) return null
  return {
    riskTier: s.clinicianReview?.override?.riskTier || s.riskTier,
    ageMonths: s.childAgeMonths,
    domains: s.domainBreakdown.map((d) => ({ label: d.label, atRiskCount: d.atRiskCount, totalItems: d.totalItems })),
  }
}

/** POST /api/assistant/ask { question, childId? } (caregiver / patient; rate-limited in the route) */
const askAutara = asyncHandler(async (req, res) => {
  const body = requireBodyObject(req)
  const question = cleanString(body.question, { max: 500 })
  if (!question) throw new AppError(400, 'VALIDATION_ERROR', 'Please type a question (up to 500 characters).')
  if (body.childId !== undefined && !isObjectId(body.childId)) throw new AppError(400, 'VALIDATION_ERROR', 'childId is not valid.')

  const payload = { question }
  if (body.childId) {
    const context = await childContext(req.dbUser, body.childId)
    if (context) payload.context = context
  }

  const result = await aiClient.ask(payload)
  return ok(res, {
    answer: result.answer,
    sources: result.sources || [],          // always present
    guardrail: result.guardrail || null,
    usedChildContext: !!payload.context,
    disclaimer: DISCLAIMER,
  })
})

module.exports = { askAutara, childContext }
