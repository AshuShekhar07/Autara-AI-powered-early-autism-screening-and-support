const mongoose = require('mongoose')

/** History row only — the files themselves are generated on demand and never stored. */
const reportSchema = new mongoose.Schema(
  {
    childId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    screeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true },
    format:      { type: String, enum: ['pdf', 'csv'], required: true },
    generatedBy: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

reportSchema.index({ childId: 1, createdAt: -1 })

module.exports = mongoose.model('Report', reportSchema)
