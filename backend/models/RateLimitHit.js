const mongoose = require('mongoose')

/**
 * One row per rate-limited request (see lib/rateLimit.js, store: 'mongo'). Lives in the database, so the
 * limit survives restarts and is shared by several server instances. Rows delete themselves (TTL index).
 */
const rateLimitHitSchema = new mongoose.Schema(
  {
    bucket:    { type: String, required: true },   // which limiter, e.g. 'ask'
    key:       { type: String, required: true },   // who, e.g. the user's uid
    at:        { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { versionKey: false }
)
rateLimitHitSchema.index({ bucket: 1, key: 1, at: 1 })

module.exports = mongoose.model('RateLimitHit', rateLimitHitSchema)
