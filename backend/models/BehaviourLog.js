const mongoose = require('mongoose')
const { ANTECEDENTS, BEHAVIOURS, CONSEQUENCES, SETTINGS } = require('../lib/behaviourEnums')

/**
 * One ABC (Antecedent–Behaviour–Consequence) observation. Category enums are fixed so
 * the summary aggregation can count them. `local` holds facets in the family's local time
 * (see lib/localTime.js) so charts group by the right hour / weekday / week.
 */
const behaviourLogSchema = new mongoose.Schema(
  {
    childId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    loggedBy:     { type: String, required: true },
    loggedByRole: { type: String, enum: ['caregiver', 'patient', 'therapist'], required: true },
    occurredAt:   { type: Date, required: true },

    antecedent:  { category: { type: String, enum: ANTECEDENTS, required: true }, notes: { type: String, maxlength: 500, default: '' } },
    behaviour:   { category: { type: String, enum: BEHAVIOURS, required: true },  description: { type: String, maxlength: 500, default: '' } },
    consequence: { category: { type: String, enum: CONSEQUENCES, required: true }, notes: { type: String, maxlength: 500, default: '' } },

    intensity:       { type: Number, min: 1, max: 5, required: true },
    durationMinutes: { type: Number, min: 0, max: 1440, default: null },
    setting:         { type: String, enum: SETTINGS, default: 'home' },

    tzOffsetMinutes: { type: Number, default: 0 },
    local: {
      hour:      { type: Number },
      weekday:   { type: Number },
      weekStart: { type: String },
    },

    /** Set only by `npm run seed:demo` (synthetic rows) so a re-run can replace them in place. */
    demoTag: { type: String, default: undefined },
  },
  { timestamps: true }
)

behaviourLogSchema.index({ childId: 1, occurredAt: -1 })
behaviourLogSchema.index({ childId: 1, createdAt: -1 })
behaviourLogSchema.index({ loggedBy: 1 })

module.exports = mongoose.model('BehaviourLog', behaviourLogSchema)
