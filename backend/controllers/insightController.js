const Insight = require('../models/Insight')
const aiClient = require('../lib/aiClient')
const { buildInsightEvidence } = require('../lib/evidenceBuilder')
const { advance } = require('../lib/screeningStatus')
const { loadScreening } = require('./screeningController')
const { AppError, ok, created, asyncHandler } = require('../utils/respond')
const { requireBodyObject, isObjectId } = require('../utils/validate')
const { isClinicalRole } = require('../utils/roles')
const { DISCLAIMER } = require('../lib/disclaimer')
const { audit } = require('../lib/audit')

/** What each viewer may see of an insight. */
function insightView(insight, role) {
  const i = insight.toObject ? insight.toObject() : insight
  const base = {
    id: String(i._id), screeningId: String(i.screeningId), childId: String(i.childId),
    status: i.status, generatedAt: i.generatedAt, approvedAt: i.approvedAt, disclaimer: DISCLAIMER,
  }
  if (role === 'clinician' || role === 'therapist') {
    return {
      ...base,
      summary: i.summary, caregiverSummary: i.caregiverSummary, flaggedAreas: i.flaggedAreas, uncertainty: i.uncertainty,
      clinicalReviewRequired: i.clinicalReviewRequired, model: i.model, promptVersion: i.promptVersion,
      retrievedChunkIds: i.retrievedChunkIds, readingGrade: i.readingGrade,
      failureReasons: i.failureReasons, generatedBy: i.generatedBy, approvedBy: i.approvedBy,
    }
  }
  // Caregiver / patient: ONLY the plain-language summary of an approved insight.
  return { ...base, caregiverSummary: i.caregiverSummary, aiGenerated: true, reviewedByClinician: true }
}

/** POST /api/insights/generate { screeningId } (clinician only, audited) */
const generate = asyncHandler(async (req, res) => {
  const { screeningId } = requireBodyObject(req)
  if (!isObjectId(screeningId)) throw new AppError(400, 'VALIDATION_ERROR', 'screeningId is required.')

  const { screening, child } = await loadScreening(req, screeningId)
  if (screening.status === 'REVIEWED') {
    throw new AppError(409, 'SCREENING_ALREADY_REVIEWED', 'This screening has already been reviewed and is locked.')
  }
  if (!['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW'].includes(screening.status)) {
    throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Insights can only be generated once the screening has been scored.')
  }
  if (screening.status === 'INSIGHTS_READY') { // generating an insight means the clinician is working the case
    advance(screening, 'UNDER_CLINICAL_REVIEW', req.dbUser.uid)
    await screening.save()
  }

  const evidence = await buildInsightEvidence(screening, child)
  const result = await aiClient.insights(evidence) // throws AppError 503/500 if the service is down — nothing stored

  const base = {
    screeningId: screening._id, childId: child._id, generatedBy: req.dbUser.uid,
    model: result.model || '', promptVersion: result.promptVersion || '',
    retrievedChunkIds: result.retrievedChunkIds || [], clinicalReviewRequired: true,
  }
  const insight = result.status === 'generated' && result.insight
    ? await Insight.create({
        ...base, status: 'generated',
        summary: result.insight.summary, caregiverSummary: result.insight.caregiverSummary,
        flaggedAreas: result.insight.flaggedAreas, uncertainty: result.insight.uncertainty,
        readingGrade: result.readingGrade ?? null,
      })
    : await Insight.create({ ...base, status: 'failed', failureReasons: (result.failureReasons || ['UNKNOWN']).slice(0, 10) })

  await audit(req, 'INSIGHT_GENERATED', { type: 'insight', id: insight._id },
    { screeningId: String(screening._id), status: insight.status, model: insight.model, promptVersion: insight.promptVersion })

  return created(res, { insight: insightView(insight, req.dbUser.role) })
})

/** GET /api/insights?screeningId= — clinician: all; therapist: approved (full); caregiver: approved (summary only) */
const list = asyncHandler(async (req, res) => {
  const { screeningId } = req.query
  if (!isObjectId(screeningId)) throw new AppError(400, 'VALIDATION_ERROR', 'screeningId is required.')
  await loadScreening(req, screeningId) // access check (same 404 for unknown / forbidden)

  const filter = { screeningId }
  if (req.dbUser.role !== 'clinician') filter.status = 'approved'
  const insights = await Insight.find(filter).sort({ createdAt: -1 })
  return ok(res, { insights: insights.map((i) => insightView(i, req.dbUser.role)) })
})

/** POST /api/insights/:id/approve — makes caregiverSummary visible to the caregiver (audited). */
const approve = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new AppError(404, 'INSIGHT_NOT_FOUND', 'Insight not found.')
  const insight = await Insight.findById(req.params.id)
  if (!insight) throw new AppError(404, 'INSIGHT_NOT_FOUND', 'Insight not found.')
  try {
    await loadScreening(req, String(insight.screeningId)) // clinician must be on this child's care team
  } catch (err) {
    if (err.code === 'SCREENING_NOT_FOUND') throw new AppError(404, 'INSIGHT_NOT_FOUND', 'Insight not found.')
    throw err
  }
  if (insight.status !== 'generated') {
    throw new AppError(409, 'INSIGHT_NOT_APPROVABLE', insight.status === 'approved'
      ? 'This insight has already been approved.' : 'Only a successfully generated insight can be approved.')
  }
  insight.status = 'approved'
  insight.approvedBy = req.dbUser.uid
  insight.approvedAt = new Date()
  await insight.save()
  await audit(req, 'INSIGHT_APPROVED', { type: 'insight', id: insight._id }, { screeningId: String(insight.screeningId) })
  return ok(res, { insight: insightView(insight, req.dbUser.role) })
})

module.exports = { generate, list, approve, insightView }
