import { api } from './api'

/**
 * Requests a report and saves it through the browser. The server returns the file with a
 * Content-Disposition name (initials + date only — never the child's full name).
 */
export async function downloadReport(screeningId, format) {
  const { blob, filename } = await api.download('/api/reports/export', { screeningId, format })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
