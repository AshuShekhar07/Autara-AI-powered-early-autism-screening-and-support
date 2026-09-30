const { AppError } = require('../utils/respond')

/**
 * Tiny per-user sliding-window rate limiter (in memory).
 * Good enough for one server process; a restart resets the counters, and several instances
 * would each keep their own count (use Redis if you ever scale out — see docs/DECISIONS.md).
 *
 *   rateLimit({ max: 20, windowMs: 3_600_000, key: (req) => req.dbUser.uid })
 */
function rateLimit({ max, windowMs, key, now = () => Date.now() }) {
  const hits = new Map() // key → [timestamps within the window]

  const middleware = function (req, res, next) {
    const k = key(req)
    const t = now()
    const recent = (hits.get(k) || []).filter((ts) => t - ts < windowMs)
    if (recent.length >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000))
      res.set('Retry-After', String(retryAfterSeconds))
      return next(new AppError(429, 'RATE_LIMITED', `You've reached the limit of ${max} questions per hour. Please try again later.`, { retryAfterSeconds }))
    }
    recent.push(t)
    hits.set(k, recent)
    next()
  }
  middleware.reset = () => hits.clear() // for tests
  return middleware
}

module.exports = { rateLimit }
