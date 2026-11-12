const { AppError } = require('../utils/respond')

/**
 * Per-user sliding-window rate limiter with two stores:
 *   - default (in memory): fine for tests / one process; a restart resets the counters.
 *   - store: 'mongo': one small row per request in MongoDB (models/RateLimitHit, TTL-cleaned), so the limit
 *     survives restarts and is shared by several server instances. If the database call fails the request
 *     is allowed (the limit is cost control, not security) and a warning is logged.
 * The Mongo store records each request before counting, so a burst of parallel requests cannot all slip through.
 *
 *   rateLimit({ max: 20, windowMs: 3_600_000, key: (req) => req.dbUser.uid, store: 'mongo', name: 'ask' })
 */
function limitedError(max, retryAfterSeconds) {
  return new AppError(429, 'RATE_LIMITED', `You've reached the limit of ${max} questions per hour. Please try again later.`, { retryAfterSeconds })
}

function rateLimit({ max, windowMs, key, now = () => Date.now(), store = 'memory', name = 'default' }) {
  const hits = new Map() // key → [timestamps within the window] (memory store)

  if (store === 'mongo') {
    const RateLimitHit = require('../models/RateLimitHit')
    const middleware = async function (req, res, next) {
      try {
        const k = key(req)
        const t = now()
        const windowStart = new Date(t - windowMs)
        // Record the request FIRST, then count every row in the window (mine included). Checking before inserting
        // let a burst of parallel requests all see "room left" and all pass. This way the request that was
        // inserted last among those allowed always sees all of them, so at most `max` can pass. In a burst a few
        // extra requests may be refused as well; that is the safe side for a cost limit.
        const mine = await RateLimitHit.create({ bucket: name, key: k, at: new Date(t), expiresAt: new Date(t + windowMs) })
        const position = await RateLimitHit.countDocuments({ bucket: name, key: k, at: { $gt: windowStart } })
        if (position > max) {
          await RateLimitHit.deleteOne({ _id: mine._id }) // refused attempts do not count against the user
          const oldest = await RateLimitHit.find({ bucket: name, key: k, at: { $gt: windowStart } }).sort({ at: 1, _id: 1 }).limit(1).lean()
          const retryAfterSeconds = Math.max(1, Math.ceil((new Date(oldest[0]?.at || t).getTime() + windowMs - t) / 1000))
          res.set('Retry-After', String(retryAfterSeconds))
          return next(limitedError(max, retryAfterSeconds))
        }
      } catch (err) {
        console.warn(`[rateLimit:${name}] database check failed, allowing request: ${err.message}`)
      }
      next()
    }
    middleware.reset = () => RateLimitHit.deleteMany({ bucket: name }) // for tests (returns a promise)
    return middleware
  }

  const middleware = function (req, res, next) {
    const k = key(req)
    const t = now()
    const recent = (hits.get(k) || []).filter((ts) => t - ts < windowMs)
    if (recent.length >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000))
      res.set('Retry-After', String(retryAfterSeconds))
      return next(limitedError(max, retryAfterSeconds))
    }
    recent.push(t)
    hits.set(k, recent)
    next()
  }
  middleware.reset = () => hits.clear() // for tests
  return middleware
}

module.exports = { rateLimit }
