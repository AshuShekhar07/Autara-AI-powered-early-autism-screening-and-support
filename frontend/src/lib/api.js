import { auth } from './firebase'

/**
 * Tiny fetch wrapper for the Autara Node API.
 *
 *  - attaches the current Firebase ID token (Authorization: Bearer …)
 *  - unwraps the response envelope:
 *        { success: true,  data }            → resolves with `data`
 *        { success: false, error: {code,…} } → throws ApiError
 *  - network failures become ApiError('NETWORK_ERROR')
 *
 * Usage:
 *   const { children } = await api.get('/api/children')
 *   await api.post('/api/screenings', { childId, answers })
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function authHeader() {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

function buildUrl(path, params) {
  const url = `${API_BASE}${path}`
  if (!params) return url
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v)
  })
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

async function send(method, path, { body, params, headers } = {}) {
  let res
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(await authHeader()),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', "Can't reach the server. Check your connection and try again.", 0)
  }
  return res
}

async function request(method, path, opts) {
  const res = await send(method, path, opts)
  let json = null
  try { json = await res.json() } catch { /* non-JSON */ }

  if (json && json.success === true) return json.data
  const err = json?.error
  throw new ApiError(
    err?.code || 'UNKNOWN_ERROR',
    err?.message || 'Something went wrong. Please try again.',
    res.status,
    err?.details,
  )
}

/** Downloads a file response (PDF / CSV). Errors still arrive as the JSON envelope. */
async function download(method, path, opts) {
  const res = await send(method, path, opts)
  if (!res.ok) {
    let err = null
    try { err = (await res.json()).error } catch { /* ignore */ }
    throw new ApiError(err?.code || 'DOWNLOAD_FAILED', err?.message || 'Download failed.', res.status)
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] || 'download'
  return { blob: await res.blob(), filename }
}

export const api = {
  get:    (path, params)       => request('GET',    path, { params }),
  post:   (path, body)         => request('POST',   path, { body: body ?? {} }),
  put:    (path, body)         => request('PUT',    path, { body: body ?? {} }),
  patch:  (path, body)         => request('PATCH',  path, { body: body ?? {} }),
  delete: (path)               => request('DELETE', path),
  download: (path, body)       => download('POST', path, { body: body ?? {} }),
}

export default api
