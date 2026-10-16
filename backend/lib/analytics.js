const User = require('../models/User')
const Child = require('../models/Child')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const Insight = require('../models/Insight')
const { localFacets } = require('./localTime')

/** k-anonymity threshold: any bucket with fewer than K records is hidden (returned as null). */
const K = 5
const WEEKS = 12
const DOC_CAP = 50_000

const suppress = (n) => (n < K ? null : n)

/**
 * Hides small buckets in a distribution { key: count }.
 * Secondary suppression: if exactly ONE bucket is hidden and a total is published, the hidden
 * value could be recovered by subtraction — so the next-smallest visible bucket is hidden too.
 */
function suppressDistribution(counts, { totalPublished = true } = {}) {
  const out = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, suppress(n)]))
  const hidden = Object.keys(out).filter((k) => out[k] === null)
  if (totalPublished && hidden.length === 1) {
    const visible = Object.keys(out).filter((k) => out[k] !== null).sort((a, b) => out[a] - out[b])
    if (visible.length) out[visible[0]] = null
  }
  return out
}

function median(values) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Last N Monday-week starts (UTC), oldest first. */
function recentWeeks(n, now = new Date()) {
  const current = new Date(`${localFacets(now, 0).weekStart}T00:00:00Z`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(current); d.setUTCDate(d.getUTCDate() - 7 * (n - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

function weeklyCounts(dates, weeks) {
  const counts = Object.fromEntries(weeks.map((w) => [w, 0]))
  for (const d of dates) {
    const w = localFacets(d, 0).weekStart
    if (w in counts) counts[w] += 1
  }
  return weeks.map((w) => ({ weekStart: w, count: suppress(counts[w]) }))
}

/**
 * Anonymised platform analytics for admins. No identifiers, no per-child data: only counts,
 * with every bucket below K hidden. The verification queue size is an operational number the
 * admin can already see in full on the queue page, so it is reported exactly.
 */
async function computeAnalytics(now = new Date()) {
  const since = new Date(now.getTime() - WEEKS * 7 * 86400000)
  const weeks = recentWeeks(WEEKS, now)

  const [roleCounts, childCount, screeningCount, logCount, insightCount, pendingCount, recentScreenings, recentLogs, reviewed, allScreeningsForTier] = await Promise.all([
    Promise.all(['caregiver', 'patient', 'therapist', 'clinician'].map(async (r) => [r, await User.countDocuments({ role: r })])),
    Child.countDocuments({}),
    Screening.countDocuments({ riskTier: { $exists: true, $ne: null } }),
    BehaviourLog.countDocuments({}),
    Insight.countDocuments({ status: 'approved' }),
    User.countDocuments({ role: { $in: ['therapist', 'clinician'] }, verified: false, verificationStatus: { $ne: 'rejected' } }),
    Screening.find({ createdAt: { $gte: since } }).select('createdAt').limit(DOC_CAP),
    BehaviourLog.find({ occurredAt: { $gte: since } }).select('occurredAt').limit(DOC_CAP),
    Screening.find({ status: 'REVIEWED', 'clinicianReview.reviewedAt': { $ne: null } }).select('createdAt clinicianReview.reviewedAt').limit(DOC_CAP),
    Screening.find({ riskTier: { $exists: true, $ne: null } }).select('riskTier clinicianReview.override').limit(DOC_CAP),
  ])

  const tiers = { low: 0, medium: 0, high: 0 }
  for (const s of allScreeningsForTier) tiers[s.clinicianReview?.override?.riskTier || s.riskTier] += 1

  const hours = reviewed.map((s) => (new Date(s.clinicianReview.reviewedAt) - new Date(s.createdAt)) / 3600000)

  return {
    k: K,
    note: `Counts below ${K} are hidden (null) to protect privacy. Nothing here identifies a person.`,
    totals: {
      users: suppressDistribution(Object.fromEntries(roleCounts)),
      children: suppress(childCount),
      screenings: suppress(screeningCount),
      behaviourLogs: suppress(logCount),
      approvedInsights: suppress(insightCount),
    },
    riskTierDistribution: suppressDistribution(tiers),
    screeningsPerWeek: weeklyCounts(recentScreenings.map((s) => s.createdAt), weeks),
    logsPerWeek: weeklyCounts(recentLogs.map((l) => l.occurredAt), weeks),
    medianHoursToReview: reviewed.length >= K ? Math.round(median(hours) * 10) / 10 : null,
    verificationQueueSize: pendingCount,
  }
}

module.exports = { computeAnalytics, suppressDistribution, median, K }
