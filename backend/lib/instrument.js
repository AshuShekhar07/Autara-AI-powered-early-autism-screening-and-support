const aiClient = require('./aiClient')

/**
 * The M-CHAT-R definition (items, domains, copyright) lives in the AI service — single source of
 * truth. Node caches it briefly so the wizard and the evidence builder don't hit the service on every call.
 */
const TTL_MS = 10 * 60 * 1000
let cached = null
let cachedAt = 0

async function getInstrument() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached
  cached = await aiClient.instrument()
  cachedAt = Date.now()
  return cached
}

const clearInstrumentCache = () => { cached = null; cachedAt = 0 }

module.exports = { getInstrument, clearInstrumentCache }
