const mongoose = require('mongoose')

const evidenceSchema = new mongoose.Schema(
  { type: { type: String, enum: ['screening_response', 'behaviour_log'], required: true }, id: { type: String, required: true } },
  { _id: false }
)
const referenceSchema = new mongoose.Schema(
  { source: { type: String, required: true }, page: { type: Number, default: null }, section: { type: String, default: null } },
  { _id: false }
)
const flaggedAreaSchema = new mongoose.Schema(
  {
    area: String, explanation: String,
    evidence: { type: [evidenceSchema], default: [] },
    references: { type: [referenceSchema], default: [] },
  },
  { _id: false }
)

/**
 * AI-generated, evidence-linked explanation of a screening. ALWAYS needs clinician review:
 * caregivers only ever see `caregiverSummary`, and only after a clinician approved it.
 */
const insightSchema = new mongoose.Schema(
  {
    screeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true },
    childId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },

    summary:          { type: String, default: '' },
    caregiverSummary: { type: String, default: '' },
    flaggedAreas:     { type: [flaggedAreaSchema], default: [] },
    uncertainty:      { type: String, default: '' },
    clinicalReviewRequired: { type: Boolean, default: true },

    model:             { type: String, default: '' },
    promptVersion:     { type: String, default: '' },
    retrievedChunkIds: { type: [String], default: [] },
    readingGrade:      { type: Number, default: null },

    status:         { type: String, enum: ['generated', 'failed', 'approved'], required: true },
    failureReasons: { type: [String], default: [] },
    generatedBy:    { type: String, required: true },
    generatedAt:    { type: Date, default: Date.now },
    approvedBy:     { type: String, default: null },
    approvedAt:     { type: Date, default: null },
  },
  { timestamps: true }
)

insightSchema.index({ screeningId: 1, createdAt: -1 })
insightSchema.index({ childId: 1, status: 1 })

module.exports = mongoose.model('Insight', insightSchema)
