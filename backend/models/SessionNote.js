const mongoose = require('mongoose')

/** Free-text therapist session note. Visible to the child's verified care-team professionals only. */
const sessionNoteSchema = new mongoose.Schema(
  {
    childId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Child', required: true },
    authorUid: { type: String, required: true },
    text:      { type: String, required: true, trim: true, maxlength: 4000 },

    /** Set only by `npm run seed:demo` (synthetic rows) so a re-run can replace them in place. */
    demoTag: { type: String, default: undefined },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
)

sessionNoteSchema.index({ childId: 1, createdAt: -1 })

module.exports = mongoose.model('SessionNote', sessionNoteSchema)
