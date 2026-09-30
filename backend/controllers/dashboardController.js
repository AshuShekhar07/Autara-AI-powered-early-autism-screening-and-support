const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const SessionNote = require('../models/SessionNote')
const Child = require('../models/Child')
const Insight = require('../models/Insight')
const User = require('../models/User')
const { screeningView } = require('../lib/screeningView')
const { ok, asyncHandler } = require('../utils/respond')
const { ageInMonths } = require('../utils/age')
const { isClinicalRole, isCareRole } = require('../utils/roles')
const { parseLimit } = require('../utils/validate')
const { behaviourLabelOf } = require('../lib/behaviourEnums')

const DAY = 86400000

/**
 * GET /api/children/:id/overview — everything the caregiver dashboard's stat cards and
 * charts need in one call.
 */
const overview = asyncHandler(async (req, res) => {
  const child = req.child
  const [screenings, logsThisWeek, lastLog] = await Promise.all([
    Screening.find({ childId: child._id, status: { $in: ['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW', 'REVIEWED'] } })
      .sort({ createdAt: -1 }).limit(12),
    BehaviourLog.countDocuments({ childId: child._id, occurredAt: { $gte: new Date(Date.now() - 7 * DAY) } }),
    BehaviourLog.findOne({ childId: child._id }).sort({ occurredAt: -1 }),
  ])
  const failed = await Screening.findOne({ childId: child._id, status: 'PROCESSING_FAILED' }).sort({ createdAt: -1 })

  const role = req.dbUser.role
  const views = screenings.map((s) => screeningView(s, role))
  const latest = views[0] || null

  const openActions = []
  if (failed) openActions.push({ id: 'retry', label: 'A screening needs to be re-scored', to: `/screenings/${failed._id}` })
  if (!latest && !failed) openActions.push({ id: 'first-screening', label: 'Complete a first screening', to: '/screening' })
  if (latest && ['medium', 'high'].includes(latest.effectiveRiskTier) && child.careTeam.length === 0) {
    openActions.push({ id: 'add-care-team', label: 'Add a clinician or therapist to share results with', to: '/dashboard#care-team' })
  }
  if (latest && latest.status === 'INSIGHTS_READY' && child.careTeam.length > 0) {
    openActions.push({ id: 'awaiting-review', label: 'Waiting for your clinician to review the latest screening', to: `/screenings/${latest.id}` })
  }
  if (logsThisWeek === 0) openActions.push({ id: 'log', label: 'Log a behaviour if you noticed something this week', to: '/behaviour' })

  return ok(res, {
    overview: {
      childId: String(child._id),
      lastScreening: latest && {
        id: latest.id, effectiveRiskTier: latest.effectiveRiskTier, riskScore: latest.riskScore,
        status: latest.status, createdAt: latest.createdAt, domainBreakdown: latest.domainBreakdown,
      },
      screeningCount: screenings.length,
      screeningTrend: [...views].reverse().map((v) => ({ id: v.id, date: v.createdAt, score: v.riskScore, tier: v.effectiveRiskTier })),
      logsThisWeek,
      lastLogAt: lastLog?.occurredAt || null,
      careTeamCount: child.careTeam.length,
      openActions,
    },
  })
})

/**
 * GET /api/children/:id/timeline — merged, newest-first feed of screenings, reviews, logs and
 * (professionals only) session notes. Caregivers never get notes or annotation text.
 */
const timeline = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit, 30, 100)
  const clinical = isClinicalRole(req.dbUser.role)
  const [screenings, logs, notes] = await Promise.all([
    Screening.find({ childId: req.child._id, status: { $ne: 'PROCESSING' } }).sort({ createdAt: -1 }).limit(limit),
    BehaviourLog.find({ childId: req.child._id }).sort({ occurredAt: -1 }).limit(limit),
    clinical ? SessionNote.find({ childId: req.child._id }).sort({ createdAt: -1 }).limit(limit) : [],
  ])

  const events = []
  for (const s of screenings) {
    events.push({
      id: `scr-${s._id}`, type: 'screening', at: s.createdAt, ref: { kind: 'screening', id: String(s._id) },
      title: 'Screening submitted',
      summary: s.riskTier ? `M-CHAT-R · ${s.riskScore}/20 answers flagged · ${s.riskTier} tier` : 'M-CHAT-R · awaiting scoring',
    })
    if (s.status === 'REVIEWED' && s.clinicianReview?.reviewedAt) {
      events.push({
        id: `rev-${s._id}`, type: 'review', at: s.clinicianReview.reviewedAt, ref: { kind: 'screening', id: String(s._id) },
        title: 'Reviewed by a clinician',
        summary: s.clinicianReview.override ? `Tier changed from ${s.clinicianReview.override.originalTier} to ${s.clinicianReview.override.riskTier}` : 'Questionnaire-based tier confirmed',
      })
    }
    if (clinical) {
      for (const a of s.clinicianReview?.annotations || []) {
        events.push({ id: `ann-${a._id}`, type: 'annotation', at: a.at, ref: { kind: 'screening', id: String(s._id) }, title: 'Clinician annotation', summary: a.text })
      }
    }
  }
  for (const l of logs) {
    events.push({
      id: `log-${l._id}`, type: 'behaviour_log', at: l.occurredAt, ref: { kind: 'behaviour_log', id: String(l._id) },
      title: 'Behaviour logged', summary: `${behaviourLabelOf(l.behaviour.category)} · intensity ${l.intensity}/5`,
    })
  }
  for (const n of notes) {
    events.push({ id: `note-${n._id}`, type: 'session_note', at: n.createdAt, ref: { kind: 'session_note', id: String(n._id) }, title: 'Session note', summary: n.text.slice(0, 160) })
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at))
  return ok(res, { events: events.slice(0, limit) })
})

/** GET /api/me/caseload — assigned children with last log / last screening. */
const caseload = asyncHandler(async (req, res) => {
  const children = await Child.find({ 'careTeam.uid': req.dbUser.uid }).sort({ name: 1 })
  const ids = children.map((c) => c._id)
  // Last log per child: one indexed findOne each (caseloads are small; keeps the query trivial).
  const [screenings, latestLogs] = await Promise.all([
    Screening.find({ childId: { $in: ids }, status: { $in: ['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW', 'REVIEWED'] } }).sort({ createdAt: -1 }),
    Promise.all(children.map((c) => BehaviourLog.findOne({ childId: c._id }).sort({ occurredAt: -1 }).select('occurredAt'))),
  ])
  const lastLog = Object.fromEntries(children.map((c, i) => [String(c._id), latestLogs[i]?.occurredAt || null]))
  const lastScr = {}
  const pending = {}
  for (const s of screenings) {
    const key = String(s.childId)
    if (!lastScr[key]) lastScr[key] = s
    if (['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW'].includes(s.status)) pending[key] = true
  }

  return ok(res, {
    children: children.map((c) => {
      const key = String(c._id)
      const s = lastScr[key]
      return {
        id: key, name: c.name, ageMonths: ageInMonths(c.dob),
        myRole: c.careTeam.find((m) => m.uid === req.dbUser.uid)?.role || req.dbUser.role,
        lastLogAt: lastLog[key] || null,
        lastScreening: s ? { id: String(s._id), tier: s.clinicianReview?.override?.riskTier || s.riskTier, createdAt: s.createdAt, status: s.status } : null,
        awaitingReview: !!pending[key],
      }
    }),
  })
})

/**
 * GET /api/notifications — derived from real data (no separate store):
 *   caregiver/patient → screenings recently reviewed, insights approved (Phase 5), failed scorings
 *   clinician         → number of cases waiting for review
 *   admin             → verification queue size
 */
const notifications = asyncHandler(async (req, res) => {
  const { role, uid } = req.dbUser
  const items = []
  if (isCareRole(role)) {
    const kids = await Child.find({ caregiverUid: uid })
    const ids = kids.map((k) => k._id)
    const since = new Date(Date.now() - 14 * DAY)
    const reviewed = await Screening.find({ childId: { $in: ids }, status: 'REVIEWED', 'clinicianReview.reviewedAt': { $gte: since } })
    const failed = await Screening.find({ childId: { $in: ids }, status: 'PROCESSING_FAILED' })
    for (const s of reviewed) items.push({ id: `rev-${s._id}`, type: 'review', title: 'Screening reviewed', message: 'A clinician has reviewed your child\'s screening.', at: s.clinicianReview.reviewedAt, to: `/screenings/${s._id}` })
    for (const s of failed) items.push({ id: `fail-${s._id}`, type: 'system', title: 'Screening needs a retry', message: 'We couldn\'t score a screening. Your answers are saved.', at: s.updatedAt, to: `/screenings/${s._id}` })
    const approved = await Insight.find({ childId: { $in: ids }, status: 'approved', approvedAt: { $gte: since } })
    for (const i of approved) items.push({ id: `ins-${i._id}`, type: 'insight', title: 'New reviewed insight', message: 'A clinician approved a plain-language summary for you.', at: i.approvedAt, to: `/screenings/${i.screeningId}` })
  } else if (role === 'clinician') {
    const kids = await Child.find({ 'careTeam.uid': uid })
    const waiting = await Screening.countDocuments({ childId: { $in: kids.map((k) => k._id) }, status: { $in: ['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW'] } })
    if (waiting > 0) items.push({ id: 'queue', type: 'review', title: 'Cases waiting', message: `${waiting} screening${waiting === 1 ? '' : 's'} waiting for review.`, at: new Date(), to: '/clinician' })
  } else if (role === 'admin') {
    const pendingUsers = await User.countDocuments({ role: { $in: ['therapist', 'clinician'] }, verified: false })
    if (pendingUsers > 0) items.push({ id: 'verify', type: 'system', title: 'Verification queue', message: `${pendingUsers} professional account${pendingUsers === 1 ? '' : 's'} waiting for verification.`, at: new Date(), to: '/admin' })
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at))
  return ok(res, { notifications: items.slice(0, 20) })
})

module.exports = { overview, timeline, caseload, notifications }
