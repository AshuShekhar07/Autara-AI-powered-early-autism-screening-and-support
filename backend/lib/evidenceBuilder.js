const BehaviourLog = require('../models/BehaviourLog')
const { computeBehaviourSummary } = require('./behaviourSummary')
const { getInstrument } = require('./instrument')

const MAX_LOGS = 20
const MAX_NOTE = 160

/**
 * Replaces the child's name (whole words) with "[child]" so it never reaches the LLM.
 * Word edges are Unicode-aware: JavaScript's \b only knows A–Z, so "Ānya", "José" or "आरव" were never matched.
 */
function scrub(text, names) {
  let out = String(text || '')
  for (const n of names.filter((x) => x && x.length >= 2)) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, 'giu'), '[child]')
  }
  return out.slice(0, MAX_NOTE)
}

/**
 * Builds the MINIMUM evidence the AI service needs to explain a screening:
 *   - the 20 answers (with item text), flagged items, domain breakdown, score/tier
 *   - a compact behaviour summary + up to 20 recent logs (ids, categories, short scrubbed notes)
 *   - the child's age in MONTHS only — never a name, date of birth, or any identifier.
 */
async function buildInsightEvidence(screening, child) {
  const instrument = await getInstrument()
  const flagged = new Set(screening.atRiskItems)
  const nameParts = String(child.name || '').split(/\s+/)

  const [summary, logs] = await Promise.all([
    computeBehaviourSummary(child._id),
    BehaviourLog.find({ childId: child._id }).sort({ occurredAt: -1 }).limit(MAX_LOGS),
  ])

  return {
    screening: {
      id: String(screening._id),
      instrument: screening.instrument,
      childAgeMonths: screening.childAgeMonths,
      riskScore: screening.riskScore,
      riskTier: screening.riskTier,
      atRiskItems: screening.atRiskItems,
      answers: instrument.items.map((it) => ({
        item: it.number, text: it.text, answer: screening.answers[String(it.number)], flagged: flagged.has(it.number),
      })),
      domainBreakdown: screening.domainBreakdown.map((d) => ({
        domain: d.domain, label: d.label, atRiskCount: d.atRiskCount, totalItems: d.totalItems,
      })),
    },
    behaviour: {
      summary: {
        totalLogs: summary.totalLogs,
        averageIntensity: summary.averageIntensity,
        byBehaviour: summary.byBehaviour.slice(0, 5).map((b) => ({ behaviour: b.category, count: b.count, averageIntensity: b.averageIntensity })),
        topPairs: summary.topPairs.map((p) => ({ antecedent: p.antecedent, behaviour: p.behaviour, count: p.count })),
        weeklyTrend: summary.weeklyTrend.slice(-8).map((w) => ({ weekStart: w.weekStart, count: w.count })),
      },
      recentLogs: logs.map((l) => ({
        id: String(l._id),
        occurredAt: l.occurredAt.toISOString(),
        antecedent: l.antecedent.category,
        behaviour: l.behaviour.category,
        consequence: l.consequence.category,
        intensity: l.intensity,
        durationMinutes: l.durationMinutes,
        setting: l.setting,
        notes: scrub([l.behaviour.description, l.antecedent.notes, l.consequence.notes].filter(Boolean).join(' | '), nameParts),
      })),
    },
  }
}

module.exports = { buildInsightEvidence, scrub }
