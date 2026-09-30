const { AppError } = require('../utils/respond')

/**
 * Thin HTTP client for the internal FastAPI AI service.
 *
 *  - Adds the shared secret header  X-Internal-Key  (env AI_SERVICE_KEY)
 *  - Per-call timeouts: screen 10 s, insights 60 s (ask 30 s, health 3 s)
 *  - ONE retry, and only when the network call itself failed (connection
 *    refused / reset). HTTP error responses and timeouts are never retried:
 *    a 4xx would fail again, and retrying a 60 s LLM call would double the wait.
 *  - Failures become AppErrors with clear codes:
 *      AI_SERVICE_UNAVAILABLE (503)  service down / unreachable
 *      AI_SERVICE_TIMEOUT     (503)  service too slow
 *      AI_SERVICE_ERROR       (500)  service answered with an error (message passed through if it is one of ours)
 */

const TIMEOUTS = { screen: 10_000, insights: 60_000, ask: 30_000, health: 3_000 }

function baseUrl() {
  return (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
}

async function callOnce(path, { method, body, timeoutMs }) {
  return fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': process.env.AI_SERVICE_KEY || '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function request(path, { method = 'POST', body, timeoutMs }) {
  let res
  try {
    try {
      res = await callOnce(path, { method, body, timeoutMs })
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw err
      res = await callOnce(path, { method, body, timeoutMs }) // single retry on network error
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new AppError(503, 'AI_SERVICE_TIMEOUT', 'The AI service took too long to respond. Please try again.')
    }
    throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'The AI service is currently unavailable. Please try again later.')
  }

  let payload = null
  try { payload = await res.json() } catch { /* non-JSON body */ }

  if (!res.ok) {
    // FastAPI: { detail: ... }. Only pass through short strings; never dump internals.
    const detail = typeof payload?.detail === 'string' ? payload.detail : null
    if (res.status === 401 || res.status === 403) {
      throw new AppError(500, 'AI_SERVICE_ERROR', 'The AI service rejected the request (check AI_SERVICE_KEY).')
    }
    throw new AppError(500, 'AI_SERVICE_ERROR', detail || 'The AI service returned an error.', { upstreamStatus: res.status })
  }
  return payload
}

module.exports = {
  TIMEOUTS,
  screen:   (payload) => request('/screen',   { body: payload, timeoutMs: TIMEOUTS.screen }),
  insights: (payload) => request('/insights', { body: payload, timeoutMs: TIMEOUTS.insights }),
  ask:      (payload) => request('/ask',      { body: payload, timeoutMs: TIMEOUTS.ask }),
  health:   ()        => request('/health',   { method: 'GET', timeoutMs: TIMEOUTS.health }),
}
