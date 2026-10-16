const mongoose = require('mongoose')
const BehaviourLog = require('../models/BehaviourLog')
const { ANTECEDENTS, BEHAVIOURS, CONSEQUENCES } = require('./behaviourEnums')

/**
 * Behaviour summary via MongoDB aggregation.
 *
 * Every pipeline is just $match → $group with $sum (count, and intensity sum so averages can be
 * computed as sum ÷ count in JS). Deliberately no date operators: hour / weekday / week are stored
 * on each log in the family's local time (see lib/localTime.js).
 *
 * Returned shape (all counts are plain numbers, empty buckets are filled so charts don't have gaps):
 *  {
 *    totalLogs, averageIntensity,
 *    byBehaviour:  [{ category, count, averageIntensity }],
 *    matrix:       [{ antecedent, behaviour, count }],                  // antecedent × behaviour
 *    consequencesByBehaviour: [{ behaviour, consequence, count }],
 *    weeklyTrend:  [{ weekStart, count, averageIntensity }],            // ascending, gaps = 0
 *    byHour:       [{ hour: 0..23, count }],
 *    byWeekday:    [{ weekday: 0..6 (Mon=0), count }],
 *    topPairs:     [{ antecedent, behaviour, count, share }]            // top 3
 *  }
 */
const round2 = (n) => Math.round(n * 100) / 100

function matchStage(childId, from, to) {
  const match = { childId: new mongoose.Types.ObjectId(String(childId)) }
  if (from || to) {
    match.occurredAt = {}
    if (from) match.occurredAt.$gte = from
    if (to) match.occurredAt.$lte = to
  }
  return { $match: match }
}

// One accumulator per $group keeps every pipeline trivial (and portable to Mongo-compatible
// engines used in local testing, where several $sum accumulators in one $group misbehave).
const countBy = (keyFields) => [{ $group: { _id: keyFields, count: { $sum: 1 } } }]
const intensityBy = (keyFields) => [{ $group: { _id: keyFields, intensitySum: { $sum: '$intensity' } } }]

/** Runs count + intensity-sum pipelines for one grouping and merges them: Map(key → {count, intensitySum}). */
async function countAndIntensity(match, keyFields) {
  const [counts, sums] = await Promise.all([
    BehaviourLog.aggregate([match, ...countBy(keyFields)]),
    BehaviourLog.aggregate([match, ...intensityBy(keyFields)]),
  ])
  const merged = new Map(counts.map((r) => [JSON.stringify(r._id), { _id: r._id, count: r.count, intensitySum: 0 }]))
  for (const r of sums) {
    const row = merged.get(JSON.stringify(r._id))
    if (row) row.intensitySum = r.intensitySum
  }
  return [...merged.values()]
}

/** Continuous list of Monday week starts between two 'YYYY-MM-DD' strings (inclusive), capped. */
function weekRange(firstWeek, lastWeek, cap = 156) {
  const out = []
  const d = new Date(`${firstWeek}T00:00:00Z`)
  const end = new Date(`${lastWeek}T00:00:00Z`)
  while (d <= end && out.length < cap) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return out
}

async function computeBehaviourSummary(childId, { from = null, to = null } = {}) {
  const match = matchStage(childId, from, to)
  const [byBehaviourRaw, matrixRaw, consRaw, weekRaw, hourRaw, weekdayRaw] = await Promise.all([
    countAndIntensity(match, '$behaviour.category'),
    BehaviourLog.aggregate([match, ...countBy({ a: '$antecedent.category', b: '$behaviour.category' })]),
    BehaviourLog.aggregate([match, ...countBy({ b: '$behaviour.category', c: '$consequence.category' })]),
    countAndIntensity(match, '$local.weekStart'),
    BehaviourLog.aggregate([match, ...countBy('$local.hour')]),
    BehaviourLog.aggregate([match, ...countBy('$local.weekday')]),
  ])

  const totalLogs = byBehaviourRaw.reduce((n, r) => n + r.count, 0)
  const intensityTotal = byBehaviourRaw.reduce((n, r) => n + r.intensitySum, 0)

  const byBehaviour = byBehaviourRaw
    .map((r) => ({ category: r._id, count: r.count, averageIntensity: round2(r.intensitySum / r.count) }))
    .sort((a, b) => b.count - a.count || BEHAVIOURS.indexOf(a.category) - BEHAVIOURS.indexOf(b.category))

  const matrix = matrixRaw
    .map((r) => ({ antecedent: r._id.a, behaviour: r._id.b, count: r.count }))
    .sort((x, y) => y.count - x.count
      || ANTECEDENTS.indexOf(x.antecedent) - ANTECEDENTS.indexOf(y.antecedent)
      || BEHAVIOURS.indexOf(x.behaviour) - BEHAVIOURS.indexOf(y.behaviour))

  const consequencesByBehaviour = consRaw
    .map((r) => ({ behaviour: r._id.b, consequence: r._id.c, count: r.count }))
    .sort((x, y) => y.count - x.count
      || BEHAVIOURS.indexOf(x.behaviour) - BEHAVIOURS.indexOf(y.behaviour)
      || CONSEQUENCES.indexOf(x.consequence) - CONSEQUENCES.indexOf(y.consequence))

  // Weekly trend with zero-filled gaps
  const weekMap = Object.fromEntries(weekRaw.filter((r) => r._id).map((r) => [r._id, r]))
  const weekKeys = Object.keys(weekMap).sort()
  const weeklyTrend = weekKeys.length
    ? weekRange(weekKeys[0], weekKeys[weekKeys.length - 1]).map((w) => ({
        weekStart: w,
        count: weekMap[w]?.count || 0,
        averageIntensity: weekMap[w] ? round2(weekMap[w].intensitySum / weekMap[w].count) : null,
      }))
    : []

  const hourMap = Object.fromEntries(hourRaw.map((r) => [r._id, r.count]))
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourMap[hour] || 0 }))
  const dayMap = Object.fromEntries(weekdayRaw.map((r) => [r._id, r.count]))
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, count: dayMap[weekday] || 0 }))

  const topPairs = matrix.slice(0, 3).map((p) => ({ ...p, share: totalLogs ? round2(p.count / totalLogs) : 0 }))

  return {
    totalLogs,
    averageIntensity: totalLogs ? round2(intensityTotal / totalLogs) : null,
    byBehaviour, matrix, consequencesByBehaviour, weeklyTrend, byHour, byWeekday, topPairs,
  }
}

module.exports = { computeBehaviourSummary }
