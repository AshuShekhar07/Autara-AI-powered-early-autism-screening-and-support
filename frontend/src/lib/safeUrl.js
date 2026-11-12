/** Returns the URL only if it is a plain http(s) link, else null (blocks javascript:, data:, etc. before it reaches an href). */
export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}
