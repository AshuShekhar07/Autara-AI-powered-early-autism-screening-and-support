const definition = require('../data/mchatr-instrument.json')

/**
 * Offline fallback for M-CHAT-R scoring — used ONLY when the AI service can't be reached, so a
 * screening still works with just Node + MongoDB + Firebase running.
 *
 * It applies the same official rules as ai-service/app/screening/mchatr.py, driven by a JSON copy
 * of the instrument that is generated FROM the Python module (and checked for drift by a pytest):
 *   - items 2, 5 and 12: a "yes" answer is flagged; every other item: a "no" answer is flagged
 *   - total 0–2 → low, 3–7 → medium, 8–20 → high
 * The domain grouping is Autara's own (not part of the official instrument).
 * No ML probability is available here: modelProbability is null.
 */
const REVERSE = new Set(definition.reverseScoredItems)
const LOCAL_MODEL_VERSION = 'mchatr-rules-v1-local'

function tierFor(total) {
  if (total <= 2) return 'low'
  if (total <= 7) return 'medium'
  return 'high'
}

/** answers: { "1": "yes" | "no", ... "20": ... } (already validated by the controller) */
function scoreLocally(answers) {
  const atRiskItems = definition.items
    .map((it) => it.number)
    .filter((n) => (REVERSE.has(n) ? answers[String(n)] === 'yes' : answers[String(n)] === 'no'))

  return {
    riskScore: atRiskItems.length,
    riskTier: tierFor(atRiskItems.length),
    atRiskItems,
    domainBreakdown: definition.domains.map((d) => ({
      domain: d.key,
      label: d.label,
      atRiskCount: d.items.filter((n) => atRiskItems.includes(n)).length,
      totalItems: d.items.length,
    })),
    modelProbability: null,
    modelVersion: LOCAL_MODEL_VERSION,
  }
}

module.exports = { scoreLocally, tierFor, LOCAL_MODEL_VERSION, localDefinition: definition }
