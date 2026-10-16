const mongoose = require('mongoose')

/**
 * Append-only record of sensitive actions (verification, overrides, insight
 * generation, care-team changes, exports). Written via lib/audit.js.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorUid:   { type: String, required: true, index: true },
    actorRole:  { type: String, required: true },
    action:     { type: String, required: true, index: true }, // e.g. SCREENING_OVERRIDDEN
    targetType: { type: String, required: true },              // e.g. 'screening', 'user', 'child'
    targetId:   { type: String, required: true },
    meta:       { type: mongoose.Schema.Types.Mixed, default: {} },
    at:         { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
)

module.exports = mongoose.model('AuditLog', auditLogSchema)
