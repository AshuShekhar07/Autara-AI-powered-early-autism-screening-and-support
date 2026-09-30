import React from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { DISCLAIMER } from '../lib/screeningCopy'

/**
 * Caregiver view of an AI insight: ONLY a clinician-approved, plain-language summary.
 * Until a clinician approves one, nothing AI-written is shown (the API returns nothing).
 * Props: screeningId
 */
export default function InsightForFamily({ screeningId }) {
  const { data, loading, error, reload } = useApi(() => api.get('/api/insights', { screeningId }), [screeningId], !!screeningId)
  const insight = data?.insights?.[0]

  return (
    <section className="sc-card sr-section" aria-labelledby="ifam-h">
      <h2 id="ifam-h">Summary from your clinician's review</h2>
      {loading ? <div role="status" aria-busy="true" style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner spinner--brand" /></div>
      : error ? <div role="alert"><p className="sc-muted">Couldn't load this right now: {error}</p><button type="button" className="btn btn--ghost" onClick={reload}>Try again</button></div>
      : !insight ? (
        <p className="sc-muted" role="status">
          No summary yet. A written summary appears here only after a clinician has reviewed it — you'll get a notification when it does.
        </p>
      ) : (
        <>
          <p>{insight.caregiverSummary}</p>
          <p className="sc-hint">
            This plain-language summary was drafted with AI and approved by your clinician{insight.approvedAt ? ` on ${formatDate(insight.approvedAt)}` : ''}.
          </p>
          <p className="sr-disclaimer" role="note">{DISCLAIMER}</p>
        </>
      )}
    </section>
  )
}
