const mongoose = require('mongoose')

/**
 * A child whose screening / behaviour data Autara manages.
 * A caregiver can have several children. Verified therapists / clinicians
 * see a child only if they appear in `careTeam` (added by the caregiver).
 */
const careTeamSchema = new mongoose.Schema(
  {
    uid:     { type: String, required: true },
    role:    { type: String, enum: ['therapist', 'clinician'], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const childSchema = new mongoose.Schema(
  {
    caregiverUid: { type: String, required: true, index: true },
    name:         { type: String, required: true, trim: true, maxlength: 120 },
    dob:          { type: Date, required: true },
    sex:          { type: String, enum: ['female', 'male', 'other'], default: undefined },
    careTeam:     { type: [careTeamSchema], default: [] },

    /** Caregiver-owned milestone review statuses: { language: 'reviewed', ... } (Phase 4). */
    milestones:   { type: Map, of: String, default: {} },

    /** True for the Child created once from the signup profile (idempotent migration). */
    fromSignupProfile: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
)

childSchema.index({ 'careTeam.uid': 1 })
childSchema.index({ caregiverUid: 1, createdAt: 1 })

module.exports = mongoose.model('Child', childSchema)
