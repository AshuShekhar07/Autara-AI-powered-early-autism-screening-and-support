const BehaviourLog = require('../models/BehaviourLog')
const { computeBehaviourSummary } = require('../lib/behaviourSummary')
const { localFacets } = require('../lib/localTime')
const { ANTECEDENTS, BEHAVIOURS, CONSEQUENCES, SETTINGS } = require('../lib/behaviourEnums')
const { AppError, ok, created, asyncHandler } = require('../utils/respond')
const { requireBodyObject, cleanString, parseDate, parseLimit, isObjectId } = require('../utils/validate')
const { audit } = require('../lib/audit')

const CLOCK_SKEW_MS = 5 * 60 * 1000 // allow a little client clock drift when logging "now"

function logView(l) {
  const o = l.toObject ? l.toObject() : l
  return {
    id: String(o._id),
    childId: String(o.childId),
    loggedBy: o.loggedBy,
    loggedByRole: o.loggedByRole,
    occurredAt: o.occurredAt,
    antecedent: o.antecedent,
    behaviour: o.behaviour,
    consequence: o.consequence,
    intensity: o.intensity,
    durationMinutes: o.durationMinutes,
    setting: o.setting,
    createdAt: o.createdAt,
  }
}

function pickEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be one of: ${allowed.join(', ')}.`)
  }
  return value
}

function optionalText(value, field, max = 500) {
  if (value === undefined || value === null || value === '') return ''
  const s = cleanString(value, { max, allowEmpty: true })
  if (s === null) throw new AppError(400, 'VALIDATION_ERROR', `${field} must be text up to ${max} characters.`)
  return s
}

/** Validates create (partial=false) or update (partial=true) bodies into a plain object of fields. */
function parseLogInput(body, { partial }) {
  const out = {}
  const has = (k) => body[k] !== undefined

  if (!partial || has('occurredAt')) {
    const when = has('occurredAt') ? parseDate(body.occurredAt) : new Date()
    if (!when) throw new AppError(400, 'VALIDATION_ERROR', 'occurredAt must be a valid date.')
    if (when.getTime() > Date.now() + CLOCK_SKEW_MS) throw new AppError(400, 'VALIDATION_ERROR', 'occurredAt cannot be in the future.')
    out.occurredAt = when
  }

  for (const [key, allowed, textKey] of [
    ['antecedent', ANTECEDENTS, 'notes'], ['behaviour', BEHAVIOURS, 'description'], ['consequence', CONSEQUENCES, 'notes'],
  ]) {
    if (!partial || has(key)) {
      const part = body[key]
      if (!part || typeof part !== 'object' || Array.isArray(part)) {
        throw new AppError(400, 'VALIDATION_ERROR', `${key} is required.`)
      }
      out[key] = {
        category: pickEnum(part.category, allowed, `${key}.category`),
        [textKey]: optionalText(part[textKey], `${key}.${textKey}`),
      }
    }
  }

  if (!partial || has('intensity')) {
    const n = body.intensity
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new AppError(400, 'VALIDATION_ERROR', 'intensity must be a whole number from 1 to 5.')
    out.intensity = n
  }
  if (has('durationMinutes')) {
    const d = body.durationMinutes
    if (d !== null && (!Number.isFinite(d) || d < 0 || d > 1440)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'durationMinutes must be between 0 and 1440.')
    }
    out.durationMinutes = d
  }
  if (has('setting')) out.setting = pickEnum(body.setting, SETTINGS, 'setting')
  if (has('tzOffsetMinutes')) {
    const tz = body.tzOffsetMinutes
    if (!Number.isInteger(tz) || tz < -840 || tz > 840) throw new AppError(400, 'VALIDATION_ERROR', 'tzOffsetMinutes must be between -840 and 840.')
    out.tzOffsetMinutes = tz
  }
  return out
}

/** POST /api/children/:id/behaviour-logs (caregiver / patient / therapist) */
const createLog = asyncHandler(async (req, res) => {
  const fields = parseLogInput(requireBodyObject(req), { partial: false })
  const tz = fields.tzOffsetMinutes ?? 0
  const log = await BehaviourLog.create({
    ...fields,
    tzOffsetMinutes: tz,
    local: localFacets(fields.occurredAt, tz),
    childId: req.child._id,
    loggedBy: req.dbUser.uid,
    loggedByRole: req.dbUser.role,
  })
  return created(res, { log: logView(log) })
})

/** GET /api/children/:id/behaviour-logs?from=&to=&category=&limit=&before= */
const listLogs = asyncHandler(async (req, res) => {
  const filter = { childId: req.child._id }
  const { from, to, category, before } = req.query

  const range = {}
  if (from !== undefined) { const d = parseDate(from); if (!d) throw new AppError(400, 'VALIDATION_ERROR', '"from" must be a date.'); range.$gte = d }
  if (to !== undefined)   { const d = parseDate(to);   if (!d) throw new AppError(400, 'VALIDATION_ERROR', '"to" must be a date.');   range.$lte = d }
  if (before !== undefined) { const d = parseDate(before); if (!d) throw new AppError(400, 'VALIDATION_ERROR', '"before" must be a date.'); range.$lt = d }
  if (Object.keys(range).length) filter.occurredAt = range
  if (category !== undefined) filter['behaviour.category'] = pickEnum(category, BEHAVIOURS, 'category')

  const limit = parseLimit(req.query.limit, 20, 100)
  const rows = await BehaviourLog.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(limit + 1)
  const page = rows.slice(0, limit)
  return ok(res, {
    logs: page.map(logView),
    nextBefore: rows.length > limit ? page[page.length - 1].occurredAt : null,
  })
})

/** Loads a log of the already-authorised child; only its author may change/delete it. */
async function loadOwnLog(req) {
  if (!isObjectId(req.params.logId)) throw new AppError(404, 'LOG_NOT_FOUND', 'Behaviour log not found.')
  const log = await BehaviourLog.findOne({ _id: req.params.logId, childId: req.child._id })
  if (!log) throw new AppError(404, 'LOG_NOT_FOUND', 'Behaviour log not found.')
  if (log.loggedBy !== req.dbUser.uid) {
    throw new AppError(403, 'AUTHOR_ONLY', 'Only the person who wrote this entry can change or delete it.')
  }
  return log
}

/** PATCH /api/children/:id/behaviour-logs/:logId (author only, audited) */
const updateLog = asyncHandler(async (req, res) => {
  const log = await loadOwnLog(req)
  const fields = parseLogInput(requireBodyObject(req), { partial: true })
  Object.assign(log, fields)
  if (fields.occurredAt || fields.tzOffsetMinutes !== undefined) {
    log.local = localFacets(log.occurredAt, log.tzOffsetMinutes)
  }
  await log.save()
  await audit(req, 'BEHAVIOUR_LOG_UPDATED', { type: 'behaviour_log', id: log._id }, { childId: String(req.child._id), fields: Object.keys(fields) })
  return ok(res, { log: logView(log) })
})

/** DELETE /api/children/:id/behaviour-logs/:logId (author only, audited) */
const deleteLog = asyncHandler(async (req, res) => {
  const log = await loadOwnLog(req)
  await log.deleteOne()
  await audit(req, 'BEHAVIOUR_LOG_DELETED', { type: 'behaviour_log', id: log._id }, { childId: String(req.child._id) })
  return ok(res, { deleted: true })
})

/** GET /api/children/:id/behaviour-summary?from=&to= */
const summary = asyncHandler(async (req, res) => {
  const from = req.query.from !== undefined ? parseDate(req.query.from) : null
  const to = req.query.to !== undefined ? parseDate(req.query.to) : null
  if (req.query.from !== undefined && !from) throw new AppError(400, 'VALIDATION_ERROR', '"from" must be a date.')
  if (req.query.to !== undefined && !to) throw new AppError(400, 'VALIDATION_ERROR', '"to" must be a date.')
  const data = await computeBehaviourSummary(req.child._id, { from, to })
  return ok(res, { summary: { range: { from, to }, ...data } })
})

module.exports = { createLog, listLogs, updateLog, deleteLog, summary, logView, parseLogInput }
