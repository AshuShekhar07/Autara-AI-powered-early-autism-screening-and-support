const Screening = require('../models/Screening')
const aiClient = require('../lib/aiClient')
const { getInstrument } = require('../lib/instrument')
const { advance } = require('../lib/screeningStatus')
const { screeningView } = require('../lib/screeningView')
const { getAccessibleChild } = require('../middleware/childAccess')
const { AppError, ok, created, asyncHandler } = require('../utils/respond')
const { requireBodyObject, isObjectId, parseLimit, parseDate } = require('../utils/validate')
const { ageInMonths } = require('../utils/age')
const { audit } = require('../lib/audit')

// M-CHAT-R is validated for 16–30 months (inclusive).
const MIN_AGE_MONTHS = 16
const MAX_AGE_MONTHS = 30
const ITEM_COUNT = 20

/** Requires exactly items "1".."20" with yes/no values; returns a clean { "1": "yes", … }. */
function validateAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError(400, 'INVALID_ANSWERS', 'answers must be an object mapping item numbers to "yes" or "no".')
  }
  const clean = {}
  for (const [key, value] of Object.entries(raw)) {
    const n = Number(key)
    if (!Number.isInteger(n) || n < 1 || n > ITEM_COUNT) {
      throw new AppError(400, 'INVALID_ANSWERS', `Unknown item "${key}". Items are numbered 1–${ITEM_COUNT}.`)
    }
    const v = typeof value === 'string' ? value.trim().toLowerCase() : null
    if (v !== 'yes' && v !== 'no') {
      throw new AppError(400, 'INVALID_ANSWERS', `Item ${n}: answer must be "yes" or "no".`)
    }
    clean[String(n)] = v
  }
  const missing = []
  for (let n = 1; n <= ITEM_COUNT; n++) if (!clean[String(n)]) missing.push(n)
  if (missing.length) {
    throw new AppError(400, 'INCOMPLETE_ANSWERS', `Please answer all ${ITEM_COUNT} questions. Missing: ${missing.join(', ')}.`, { missing })
  }
  return clean
}

/**
 * Runs the scorer for a screening that is in PROCESSING and records the outcome.
 * A scorer outage is NOT thrown to the client: the screening is saved as PROCESSING_FAILED
 * so the caregiver can retry without re-entering answers.
 */
async function runScoring(screening) {
  try {
    const result = await aiClient.screen({ answers: screening.answers })
    screening.riskScore = result.riskScore
    screening.riskTier = result.riskTier
    screening.atRiskItems = result.atRiskItems
    screening.domainBreakdown = result.domainBreakdown
    screening.modelProbability = result.modelProbability ?? null
    screening.modelVersion = result.modelVersion ?? null
    screening.failureCode = null
    advance(screening, 'INSIGHTS_READY')
  } catch (err) {
    screening.failureCode = err.code || 'SCORING_FAILED'
    advance(screening, 'PROCESSING_FAILED')
    console.error('[screening] scoring failed:', screening.failureCode)
  }
  await screening.save()
}

/** GET /api/screenings/instrument — the questionnaire (items, copyright, domains). */
const instrument = asyncHandler(async (_req, res) => {
  return ok(res, { instrument: await getInstrument() })
})

/** POST /api/screenings { childId, answers } (caregiver / patient) */
const createScreening = asyncHandler(async (req, res) => {
  const body = requireBodyObject(req)
  if (!isObjectId(body.childId)) throw new AppError(400, 'VALIDATION_ERROR', 'childId is required.')

  const { child, relation } = await getAccessibleChild(req.dbUser, body.childId)
  if (relation !== 'owner') throw new AppError(403, 'OWNER_ONLY', "Only the child's caregiver can submit a screening.")

  const answers = validateAnswers(body.answers)

  // Age is computed on the server from the stored date of birth — never trusted from the client.
  const childAgeMonths = ageInMonths(child.dob)
  if (childAgeMonths < MIN_AGE_MONTHS || childAgeMonths > MAX_AGE_MONTHS) {
    throw new AppError(400, 'AGE_OUT_OF_RANGE',
      `The M-CHAT-R is designed for children aged ${MIN_AGE_MONTHS}–${MAX_AGE_MONTHS} months. ` +
      `This child is ${childAgeMonths} months old.`,
      { childAgeMonths, minMonths: MIN_AGE_MONTHS, maxMonths: MAX_AGE_MONTHS })
  }

  const screening = new Screening({
    childId: child._id, submittedBy: req.dbUser.uid, childAgeMonths, answers,
  })
  screening.statusHistory.push({ status: 'DRAFT', at: new Date(), by: req.dbUser.uid })
  advance(screening, 'SCREENING_SUBMITTED', req.dbUser.uid)
  advance(screening, 'PROCESSING', req.dbUser.uid)
  await screening.save() // persist BEFORE calling the AI service so nothing is lost if it is down

  await runScoring(screening)
  await audit(req, 'SCREENING_SUBMITTED', { type: 'screening', id: screening._id }, { status: screening.status })

  return created(res, { screening: screeningView(screening, req.dbUser.role) })
})

/** Loads a screening and checks the viewer may see its child. Unknown / forbidden → same 404. */
async function loadScreening(req, id) {
  if (!isObjectId(id)) throw new AppError(404, 'SCREENING_NOT_FOUND', 'Screening not found.')
  const screening = await Screening.findById(id)
  if (!screening) throw new AppError(404, 'SCREENING_NOT_FOUND', 'Screening not found.')
  try {
    const access = await getAccessibleChild(req.dbUser, String(screening.childId))
    return { screening, child: access.child, relation: access.relation }
  } catch (err) {
    if (err.code === 'CHILD_NOT_FOUND') throw new AppError(404, 'SCREENING_NOT_FOUND', 'Screening not found.')
    throw err
  }
}

/** GET /api/screenings?childId=&limit=&before= */
const listScreenings = asyncHandler(async (req, res) => {
  const { childId } = req.query
  if (!isObjectId(childId)) throw new AppError(400, 'VALIDATION_ERROR', 'childId is required.')
  await getAccessibleChild(req.dbUser, childId)

  const filter = { childId }
  if (req.query.before !== undefined) {
    const before = parseDate(req.query.before)
    if (!before) throw new AppError(400, 'VALIDATION_ERROR', '"before" must be an ISO date.')
    filter.createdAt = { $lt: before }
  }
  const limit = parseLimit(req.query.limit, 20, 100)
  const rows = await Screening.find(filter).sort({ createdAt: -1 }).limit(limit + 1)
  const page = rows.slice(0, limit)

  return ok(res, {
    screenings: page.map((s) => screeningView(s, req.dbUser.role)),
    nextBefore: rows.length > limit ? page[page.length - 1].createdAt : null,
  })
})

/** GET /api/screenings/:id */
const getScreening = asyncHandler(async (req, res) => {
  const { screening } = await loadScreening(req, req.params.id)
  return ok(res, { screening: screeningView(screening, req.dbUser.role) })
})

/** POST /api/screenings/:id/retry — only for PROCESSING_FAILED (owner). */
const retryScreening = asyncHandler(async (req, res) => {
  const { screening, relation } = await loadScreening(req, req.params.id)
  if (relation !== 'owner') throw new AppError(403, 'OWNER_ONLY', "Only the child's caregiver can retry a screening.")
  advance(screening, 'PROCESSING', req.dbUser.uid) // throws 409 unless currently PROCESSING_FAILED
  await screening.save()
  await runScoring(screening)
  return ok(res, { screening: screeningView(screening, req.dbUser.role) })
})

module.exports = {
  instrument, createScreening, listScreenings, getScreening, retryScreening,
  loadScreening, validateAnswers, MIN_AGE_MONTHS, MAX_AGE_MONTHS,
}
