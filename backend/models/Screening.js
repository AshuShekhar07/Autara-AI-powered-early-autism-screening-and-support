const mongoose = require('mongoose')

const STATUSES = [
  'DRAFT', 'SCREENING_SUBMITTED', 'PROCESSING', 'INSIGHTS_READY',
  'PROCESSING_FAILED', 'UNDER_CLINICAL_REVIEW', 'REVIEWED',
]

const annotationSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 2000 },
    by:   { type: String, required: true }, // clinician uid
    at:   { type: Date, default: Date.now },
  },
  { _id: true }
)

const domainSchema = new mongoose.Schema(
  {
    domain:      String,
    label:       String,
    atRiskCount: Number,
    totalItems:  Number,
  },
  { _id: false }
)

/**
 * One completed M-CHAT-R screening. `riskScore`/`riskTier` come from the rule-based
 * scorer in the AI service and are authoritative; a clinician can override the tier
 * (both values are kept). Status changes go through lib/screeningStatus.js only.
 */
const screeningSchema = new mongoose.Schema(
  {
    childId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    submittedBy:    { type: String, required: true }, // uid
    instrument:     { type: String, enum: ['MCHAT-R'], default: 'MCHAT-R' },
    childAgeMonths: { type: Number, required: true },
    answers:        { type: mongoose.Schema.Types.Mixed, required: true }, // { "1": "yes", ... "20": "no" }

    riskScore:       { type: Number, min: 0, max: 20 },
    riskTier:        { type: String, enum: ['low', 'medium', 'high'] },
    atRiskItems:     { type: [Number], default: [] },
    domainBreakdown: { type: [domainSchema], default: [] },
    modelProbability: { type: Number, default: null },
    modelVersion:     { type: String, default: null },

    status:        { type: String, enum: STATUSES, default: 'DRAFT' },
    statusHistory: {
      type: [new mongoose.Schema({ status: String, at: Date, by: String }, { _id: false })],
      default: [],
    },
    failureCode:   { type: String, default: null }, // set when PROCESSING_FAILED

    clinicianReview: {
      reviewerUid: { type: String, default: null },
      annotations: { type: [annotationSchema], default: [] },
      override: {
        type: new mongoose.Schema(
          {
            riskTier:     { type: String, enum: ['low', 'medium', 'high'], required: true },
            originalTier: { type: String, enum: ['low', 'medium', 'high'], required: true },
            reason:       { type: String, required: true, maxlength: 2000 },
            by:           { type: String, required: true },
            at:           { type: Date, default: Date.now },
          },
          { _id: false }
        ),
        default: null,
      },
      reviewedAt: { type: Date, default: null },
    },

    /** Set only by `npm run seed:demo` (synthetic rows) so a re-run can replace them in place. */
    demoTag: { type: String, default: undefined },
  },
  { timestamps: true }
)

screeningSchema.index({ childId: 1, createdAt: -1 })
screeningSchema.index({ status: 1 })
screeningSchema.index({ submittedBy: 1 })

module.exports = mongoose.model('Screening', screeningSchema)
module.exports.STATUSES = STATUSES
