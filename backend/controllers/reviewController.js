const Screening = require('../models/Screening')
const Child = require('../models/Child')
const { advance } = require('../lib/screeningStatus')
const { screeningView } = require('../lib/screeningView')
const { loadScreening } = require('./screeningController')
const { AppError, ok, asyncHandler } = require('../utils/respond')
const { requireBodyObject, cleanString } = require('../utils/validate')
const { ageInMonths } = require('../utils/age')
const { audit } = require('../lib/audit')

const TIERS = ['low', 'medium', 'high']
const TIER_RANK = { high: 0, medium: 1, low: 2 }

/**
 * The clinician actions below all require the screening to be UNDER_CLINICAL_REVIEW.
 * Doing any of them on an INSIGHTS_READY screening opens it first ("opening a case moves it
 * to UNDER_CLINICAL_REVIEW"). A REVIEWED screening is locked (409).
 */
function ensureUnderReview(screening, byUid) {
  if (screening.status === 'INSIGHTS_READY') advance(screening, 'UNDER_CLINICAL_REVIEW', byUid)
  if (screening.status === 'REVIEWED') {
    throw new AppError(409, 'SCREENING_ALREADY_REVIEWED', 'This screening has already been marked as reviewed.')
  }
  if (screening.status !== 'UNDER_CLINICAL_REVIEW') {
    throw new AppError(409, 'INVALID_STATUS_TRANSITION', `A screening in status ${screening.status} cannot be reviewed yet.`)
  }
}

const respond = (req, res, screening) => ok(res, { screening: screeningView(screening, req.dbUser.role) })

/** POST /api/screenings/:id/open — clinician opens the case (idempotent). */
const openCase = asyncHandler(async (req, res) => {
  const { screening } = await loadScreening(req, req.params.id)
  if (screening.status === 'INSIGHTS_READY') {
    advance(screening, 'UNDER_CLINICAL_REVIEW', req.dbUser.uid)
    screening.clinicianReview.reviewerUid = req.dbUser.uid
    await screening.save()
    await audit(req, 'SCREENING_REVIEW_STARTED', { type: 'screening', id: screening._id })
  }
  return respond(req, res, screening)
})

/** POST /api/screenings/:id/annotations { text } */
const annotate = asyncHandler(async (req, res) => {
  const text = cleanString(requireBodyObject(req).text, { max: 2000 })
  if (!text) throw new AppError(400, 'VALIDATION_ERROR', 'Annotation text is required (up to 2000 characters).')
  const { screening } = await loadScreening(req, req.params.id)
  ensureUnderReview(screening, req.dbUser.uid)
  screening.clinicianReview.annotations.push({ text, by: req.dbUser.uid, at: new Date() })
  await screening.save()
  await audit(req, 'SCREENING_ANNOTATED', { type: 'screening', id: screening._id })
  return respond(req, res, screening)
})

/** POST /api/screenings/:id/override { riskTier, reason } — reason required; both values stored. */
const override = asyncHandler(async (req, res) => {
  const body = requireBodyObject(req)
  if (!TIERS.includes(body.riskTier)) throw new AppError(400, 'VALIDATION_ERROR', `riskTier must be one of: ${TIERS.join(', ')}.`)
  const reason = cleanString(body.reason, { max: 2000 })
  if (!reason || reason.length < 5) {
    throw new AppError(400, 'REASON_REQUIRED', 'Please give a reason (at least a short sentence) for changing the risk tier.')
  }
  const { screening } = await loadScreening(req, req.params.id)
  ensureUnderReview(screening, req.dbUser.uid)
  if (body.riskTier === screening.riskTier) {
    throw new AppError(400, 'NO_CHANGE', 'That is already the questionnaire-based tier. Add an annotation instead.')
  }
  screening.clinicianReview.override = {
    riskTier: body.riskTier, originalTier: screening.riskTier, reason, by: req.dbUser.uid, at: new Date(),
  }
  await screening.save()
  await audit(req, 'SCREENING_OVERRIDDEN', { type: 'screening', id: screening._id },
    { from: screening.riskTier, to: body.riskTier })
  return respond(req, res, screening)
})

/** POST /api/screenings/:id/review — marks the screening REVIEWED. */
const markReviewed = asyncHandler(async (req, res) => {
  const { screening } = await loadScreening(req, req.params.id)
  ensureUnderReview(screening, req.dbUser.uid)
  advance(screening, 'REVIEWED', req.dbUser.uid)
  screening.clinicianReview.reviewerUid = req.dbUser.uid
  screening.clinicianReview.reviewedAt = new Date()
  await screening.save()
  await audit(req, 'SCREENING_REVIEWED', { type: 'screening', id: screening._id },
    { overridden: !!screening.clinicianReview.override })
  return respond(req, res, screening)
})

/**
 * GET /api/me/review-queue — screenings waiting for a clinician on THEIR caseload,
 * high risk first, then longest-waiting first.
 */
const reviewQueue = asyncHandler(async (req, res) => {
  const children = await Child.find({ 'careTeam.uid': req.dbUser.uid })
  const byId = Object.fromEntries(children.map((c) => [String(c._id), c]))
  const screenings = await Screening.find({
    childId: { $in: children.map((c) => c._id) },
    status: { $in: ['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW'] },
  })

  const items = screenings
    .map((s) => {
      const c = byId[String(s.childId)]
      return {
        screeningId: String(s._id), childId: String(s.childId),
        childName: c.name, childAgeMonths: ageInMonths(c.dob), riskTier: s.riskTier, riskScore: s.riskScore,
        status: s.status, submittedAt: s.createdAt,
        waitingDays: Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 86400000),
      }
    })
    .sort((a, b) => TIER_RANK[a.riskTier] - TIER_RANK[b.riskTier] || new Date(a.submittedAt) - new Date(b.submittedAt))

  return ok(res, { queue: items })
})

module.exports = { openCase, annotate, override, markReviewed, reviewQueue, ensureUnderReview }
