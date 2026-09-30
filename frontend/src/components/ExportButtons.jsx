import React, { useState } from 'react'
import { downloadReport } from '../lib/download'

/** "Download PDF" / "Download CSV" for one screening, with busy + error state. */
export default function ExportButtons({ screeningId, onDone, compact = false }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function go(format) {
    setBusy(format); setError('')
    try { await downloadReport(screeningId, format); onDone?.() }
    catch (err) { setError(err.message) }
    setBusy('')
  }

  const cls = compact ? 'btn btn--ghost' : 'btn btn--ghost'
  const style = compact ? { padding: '6px 14px', fontSize: '.8rem' } : undefined
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        <button type="button" className={cls} style={style} onClick={() => go('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
        <button type="button" className={cls} style={style} onClick={() => go('csv')} disabled={!!busy}>{busy === 'csv' ? 'Preparing…' : 'Download CSV'}</button>
      </span>
      {error && <span role="alert" className="sc-hint" style={{ color: 'var(--error-text)' }}>{error}</span>}
    </span>
  )
}
