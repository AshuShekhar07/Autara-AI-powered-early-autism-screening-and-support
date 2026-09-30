const Report = require('../models/Report')
const Insight = require('../models/Insight')
const BehaviourLog = require('../models/BehaviourLog')
const { renderReportPdf } = require('../lib/reportPdf')
const { buildCsv } = require('../lib/reportCsv')
const { computeBehaviourSummary } = require('../lib/behaviourSummary')
const { getInstrument } = require('../lib/instrument')
const { labels } = require('../lib/behaviourEnums')
const { loadScreening } = require('./screeningController')
const { getAccessibleChild } = require('../middleware/childAccess')
const { AppError, ok, asyncHandler } = require('../utils/respond')
const { requireBodyObject, isObjectId, parseLimit } = require('../utils/validate')
const { audit } = require('../lib/audit')

const MAX_CSV_LOGS = 5000

/** "Alexandra Demo" → "A.D." — reports never carry the full name. */
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return (parts.length ? parts.map((p) => p[0].toUpperCase() + '.').join('') : '?').slice(0, 8)
}

/**
 * POST /api/reports/export { screeningId, format: 'pdf' | 'csv' }
 *  - clinicians: any scored screening on their caseload
 *  - caregivers / patients: only REVIEWED screenings of their own child
 *  - therapists: not allowed (read-only role)
 * Streams the file and records a Report history row.
 */
const exportReport = asyncHandler(async (req, res) => {
  const { screeningId, format } = requireBodyObject(req)
  if (!isObjectId(screeningId)) throw new AppError(400, 'VALIDATION_ERROR', 'screeningId is required.')
  if (!['pdf', 'csv'].includes(format)) throw new AppError(400, 'VALIDATION_ERROR', 'format must be "pdf" or "csv".')

  const { screening, child } = await loadScreening(req, screeningId)
  const role = req.dbUser.role
  const isClinician = role === 'clinician'
  if (!screening.riskTier) throw new AppError(409, 'SCREENING_NOT_SCORED', 'This screening has no result to export yet.')
  if (!isClinician && screening.status !== 'REVIEWED') {
    throw new AppError(403, 'REPORT_NOT_AVAILABLE', 'A report is available once a clinician has reviewed the screening.')
  }

  await Report.create({ childId: child._id, screeningId: screening._id, format, generatedBy: req.dbUser.uid })
  await audit(req, 'REPORT_EXPORTED', { type: 'screening', id: screening._id }, { format, audience: isClinician ? 'clinician' : 'caregiver' })

  const instrument = await getInstrument()
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `autara-report-${initialsOf(child.name).replace(/\./g, '')}-${stamp}`

  if (format === 'csv') {
    const logs = await BehaviourLog.find({ childId: child._id }).sort({ occurredAt: 1 }).limit(MAX_CSV_LOGS)
    const csv = buildCsv({ screening, instrument, logs, labels })
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.csv"`, 'Cache-Control': 'no-store' })
    return res.send(csv)
  }

  const [summary, insight] = await Promise.all([
    computeBehaviourSummary(child._id),
    Insight.findOne({ screeningId: screening._id, status: 'approved' }).sort({ approvedAt: -1 }),
  ])
  const doc = renderReportPdf({
    initials: initialsOf(child.name), ageMonths: screening.childAgeMonths, screening, instrument,
    behaviour: { ...summary, labels }, insight: insight && insight.toObject(),
    annotations: isClinician ? screening.clinicianReview?.annotations || [] : [],
    audience: isClinician ? 'clinician' : 'caregiver',
  })
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${base}.pdf"`, 'Cache-Control': 'no-store' })
  doc.pipe(res)
  doc.end()
})

/** GET /api/reports?childId= — export history for a child the viewer can access. */
const listReports = asyncHandler(async (req, res) => {
  if (!isObjectId(req.query.childId)) throw new AppError(400, 'VALIDATION_ERROR', 'childId is required.')
  await getAccessibleChild(req.dbUser, req.query.childId)
  const limit = parseLimit(req.query.limit, 20, 100)
  const rows = await Report.find({ childId: req.query.childId }).sort({ createdAt: -1 }).limit(limit)
  return ok(res, {
    reports: rows.map((r) => ({ id: String(r._id), screeningId: String(r.screeningId), format: r.format, generatedBy: r.generatedBy === req.dbUser.uid ? 'you' : 'care team', createdAt: r.createdAt })),
  })
})

module.exports = { exportReport, listReports, initialsOf }
