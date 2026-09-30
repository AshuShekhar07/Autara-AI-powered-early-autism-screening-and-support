const { isClinicalRole } = require('../utils/roles')
const { DISCLAIMER } = require('./disclaimer')

/**
 * What a given viewer may see of a screening.
 *
 *  - Everyone: answers, rule-based score/tier, at-risk items, domains, status.
 *  - Clinical roles (therapist/clinician): + model probability, status history, full clinician review.
 *  - Caregiver/patient: the model probability is never shown; clinician review details
 *    (override tier + reason) appear only once the screening is REVIEWED. Annotations stay internal.
 */
function screeningView(screening, role) {
  const s = screening.toObject ? screening.toObject() : screening
  const review = s.clinicianReview || {}
  const clinical = isClinicalRole(role)
  const reviewed = s.status === 'REVIEWED'
  const override = review.override || null

  const view = {
    id: String(s._id),
    childId: String(s.childId),
    instrument: s.instrument,
    childAgeMonths: s.childAgeMonths,
    answers: s.answers,
    riskScore: s.riskScore ?? null,
    riskTier: s.riskTier ?? null,
    atRiskItems: s.atRiskItems || [],
    domainBreakdown: s.domainBreakdown || [],
    status: s.status,
    failureCode: s.failureCode || null,
    createdAt: s.createdAt,
    disclaimer: DISCLAIMER,
  }

  if (clinical) {
    view.effectiveRiskTier = override?.riskTier || s.riskTier || null
    view.modelProbability = s.modelProbability ?? null
    view.modelVersion = s.modelVersion ?? null
    view.statusHistory = s.statusHistory || []
    view.clinicianReview = {
      reviewerUid: review.reviewerUid || null,
      annotations: review.annotations || [],
      override,
      reviewedAt: review.reviewedAt || null,
    }
  } else {
    view.effectiveRiskTier = (reviewed && override?.riskTier) || s.riskTier || null
    view.modelVersion = s.modelVersion ?? null
    view.clinicianReview = reviewed
      ? { reviewedAt: review.reviewedAt || null, override }
      : null
  }
  return view
}

module.exports = { screeningView }
