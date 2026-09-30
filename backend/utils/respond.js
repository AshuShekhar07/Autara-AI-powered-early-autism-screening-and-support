/**
 * Response envelope helpers — every Node endpoint answers in one of two shapes:
 *
 *   success: { "success": true,  "data": { ... } }
 *   error:   { "success": false, "error": { "code": "SCREENING_NOT_FOUND", "message": "..." } }
 *
 * Status codes used: 200, 201, 400, 401, 403, 404, 409, 500
 * (plus 429 for rate limits and 503 when the AI service is down — see docs/DECISIONS.md).
 */

/** Throw this from any handler; the central error handler turns it into the error envelope. */
class AppError extends Error {
  /**
   * @param {number} status  HTTP status
   * @param {string} code    UPPER_SNAKE machine-readable code
   * @param {string} message Human-readable, safe to show to the user
   * @param {object} [details] Optional extra info (never secrets / PII)
   */
  constructor(status, code, message, details) {
    super(message)
    this.name    = 'AppError'
    this.status  = status
    this.code    = code
    this.details = details
  }
}

function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, data })
}

function created(res, data = {}) {
  return ok(res, data, 201)
}

function fail(res, status, code, message, details) {
  const error = { code, message }
  if (details !== undefined) error.details = details
  return res.status(status).json({ success: false, error })
}

/** Express 4 does not catch rejected promises — wrap async handlers with this. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = { AppError, ok, created, fail, asyncHandler }
