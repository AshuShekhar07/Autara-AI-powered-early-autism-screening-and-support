/**
 * Plain-language copy for screening results. Wording is deliberately about
 * "flagged answers" and "recommended next steps" — never about a diagnosis.
 */
export const DISCLAIMER = 'This is a screening aid, not a diagnosis. Please discuss results with a qualified clinician.'

export const TIER_COPY = {
  low: {
    label: 'Lower risk',
    headline: 'Few answers were flagged',
    meaning: 'Your answers matched only a few of the things this questionnaire looks for.',
    next: "Keep an eye on your child's development and mention any worries to your child's doctor. You can screen again later.",
  },
  medium: {
    label: 'Medium risk',
    headline: 'Some answers were flagged — a follow-up is recommended',
    meaning: 'Some of your answers were flagged. That does not mean anything is wrong — it means a closer look is worthwhile.',
    next: 'We recommend a follow-up conversation with a healthcare professional, such as your child\'s pediatrician, to look at these answers together.',
  },
  high: {
    label: 'Higher risk',
    headline: 'Several answers were flagged — a professional evaluation is recommended',
    meaning: 'Several of your answers were flagged. This is a screening result only — it cannot tell you what is or is not going on for your child.',
    next: "We recommend arranging an evaluation with a qualified professional (for example, your child's pediatrician or a developmental specialist) soon. Sharing this result with them can help.",
  },
}

export const STATUS_LABELS = {
  DRAFT: 'Draft',
  SCREENING_SUBMITTED: 'Submitted',
  PROCESSING: 'Scoring…',
  INSIGHTS_READY: 'Awaiting clinician review',
  PROCESSING_FAILED: 'Scoring failed',
  UNDER_CLINICAL_REVIEW: 'Under clinical review',
  REVIEWED: 'Reviewed by clinician',
}
