const { AppError } = require('../utils/respond')

/**
 * The ONE place that knows which screening status changes are legal.
 *
 *   DRAFT → SCREENING_SUBMITTED → PROCESSING → INSIGHTS_READY ─┐
 *                                     │  ▲                     ├→ UNDER_CLINICAL_REVIEW → REVIEWED
 *                                     ▼  │ (retry)            │
 *                                PROCESSING_FAILED              │
 *
 * INSIGHTS_READY means "the risk score has been computed" (the AI *insight* text is a
 * separate Insight document, generated on demand by a clinician).
 */
const TRANSITIONS = {
  DRAFT:                 ['SCREENING_SUBMITTED'],
  SCREENING_SUBMITTED:   ['PROCESSING'],
  PROCESSING:            ['INSIGHTS_READY', 'PROCESSING_FAILED'],
  PROCESSING_FAILED:     ['PROCESSING'],            // retry
  INSIGHTS_READY:        ['UNDER_CLINICAL_REVIEW'],
  UNDER_CLINICAL_REVIEW: ['REVIEWED'],
  REVIEWED:              [],
}

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to)

/** Moves `screening` to `to` (in memory; caller saves) and records history. Throws 409 if illegal. */
function advance(screening, to, byUid = 'system') {
  if (!canTransition(screening.status, to)) {
    throw new AppError(409, 'INVALID_STATUS_TRANSITION',
      `A screening cannot move from ${screening.status} to ${to}.`)
  }
  screening.status = to
  screening.statusHistory.push({ status: to, at: new Date(), by: byUid })
  return screening
}

module.exports = { TRANSITIONS, canTransition, advance }
