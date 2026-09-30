export function formatAgeMonths(months) {
  if (months === null || months === undefined) return ''
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y > 0) parts.push(`${y} year${y > 1 ? 's' : ''}`)
  if (m > 0 || y === 0) parts.push(`${m} month${m === 1 ? '' : 's'}`)
  return parts.join(' ')
}

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', opts)
}

export function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Up to two initials from the alphabetic words of a name ("River (demo)" → "R", "Sam Demo" → "SD"). */
export function initialsOf(name) {
  const words = String(name || '').match(/\p{L}[\p{L}'’-]*/gu) || []
  if (!words.length) return '?'
  return (words.length >= 2 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase()
}
