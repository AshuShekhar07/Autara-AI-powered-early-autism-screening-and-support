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

export function initialsOf(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}
