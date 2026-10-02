const aiClient = require('./aiClient')
const { localDefinition } = require('./localScorer')

/**
 * The M-CHAT-R definition (items, domains, copyright) lives in the AI service — single source of
 * truth. Node caches it briefly so the wizard and the evidence builder don't hit the service on every call.
 *
 * If the AI service can't be reached, a JSON copy generated from the same Python module is used, so the
 * questionnaire still loads (a pytest keeps the copy in sync). A fallback result is NOT cached, so the
 * live definition is picked up again as soon as the AI service is back.
 */
const TTL_MS = 10 * 60 * 1000
let cached = null
let cachedAt = 0

async function getInstrument() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached
  try {
    cached = await aiClient.instrument()
    cachedAt = Date.now()
    return cached
  } catch (err) {
    console.warn(`[instrument] AI service unavailable (${err.code || err.message}) — using the built-in copy`)
    return localDefinition
  }
}

const clearInstrumentCache = () => { cached = null; cachedAt = 0 }

module.exports = { getInstrument, clearInstrumentCache }
