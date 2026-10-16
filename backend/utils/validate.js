const { AppError } = require('./respond')

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

const isObjectId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v)

/** Trimmed non-empty string within max length, else null. Rejects objects (NoSQL-injection guard). */
function cleanString(v, { max = 500, allowEmpty = false } = {}) {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!allowEmpty && s.length === 0) return null
  if (s.length > max) return null
  return s
}

/** Parses 'YYYY-MM-DD' or ISO date strings. Returns a Date or null. */
function parseDate(v) {
  if (typeof v !== 'string' && !(v instanceof Date)) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parses a positive integer query param with default and max clamp. */
function parseLimit(v, def = 20, max = 100) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(n, max)
}

function requireBodyObject(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(400, 'INVALID_BODY', 'Request body must be a JSON object.')
  }
  return req.body
}

module.exports = { isObjectId, cleanString, parseDate, parseLimit, requireBodyObject }
