const mongoose = require('mongoose')

/** Free-text therapist session note. Visible to the child's verified care-team professionals only. */
const sessionNoteSchema = new mongoose.Schema(
  {
    childId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    authorUid: { type: String, required: true },
    text:      { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

sessionNoteSchema.index({ childId: 1, createdAt: -1 })

module.exports = mongoose.model('SessionNote', sessionNoteSchema)
