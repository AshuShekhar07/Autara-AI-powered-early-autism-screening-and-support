import React from 'react'
import { Link } from 'react-router-dom'
import ExportButtons from '../ExportButtons'
import { useChildren } from '../../context/ChildContext'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { TIER_COPY, DISCLAIMER } from '../../lib/screeningCopy'
import './ReportsSection.css'

/**
 * Reports — export a REVIEWED screening as PDF or CSV and see the export history.
 * (Reports for a screening only become available once a clinician has reviewed it.)
 * Props: full — show the whole history instead of a preview
 */
export default function ReportsSection({ full = false }) {
  const { activeChild } = useChildren()
  const childId = activeChild?.id
  const screenings = useApi(() => api.get('/api/screenings', { childId, limit: 50 }), [childId], !!childId)
  const history = useApi(() => api.get('/api/reports', { childId, limit: full ? 50 : 5 }), [childId, full], !!childId)

  const reviewed = (screenings.data?.screenings || []).filter((s) => s.status === 'REVIEWED')
  const waiting = (screenings.data?.screenings || []).filter((s) => ['INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW'].includes(s.status)).length
  const loading = screenings.loading || history.loading
  const error = screenings.error || history.error

  return (
    <section className="reports-section" aria-labelledby="reports-heading">
      <h2 className="reports-section__heading" id="reports-heading">Reports</h2>

      {!activeChild ? null : loading ? (
        <div className="reports-empty" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      ) : error ? (
        <div className="reports-empty" role="alert">
          <p className="reports-empty__title">Couldn't load reports</p>
          <p className="reports-empty__body">{error}</p>
          <button type="button" className="btn btn--ghost" onClick={() => { screenings.reload(); history.reload() }}>Try again</button>
        </div>
      ) : reviewed.length === 0 ? (
        <div className="reports-empty" role="status" aria-label="No reports available">
          <p className="reports-empty__title">No reports yet</p>
          <p className="reports-empty__body">
            {waiting > 0
              ? 'Your screening is waiting for a clinician to review it. A downloadable report becomes available after that.'
              : 'A report is available once a screening has been reviewed by a clinician, and can be shared with your care team.'}
          </p>
          {waiting === 0 && <Link to="/screening" className="btn btn--ghost">Start a screening</Link>}
        </div>
      ) : (
        <>
          <ul className="rp-list">
            {reviewed.map((s) => (
              <li key={s.id} className="rp-row">
                <span>
                  <strong>M-CHAT-R screening · {formatDate(s.createdAt)}</strong>
                  <span className="sc-muted"> — {TIER_COPY[s.effectiveRiskTier]?.label}</span>
                </span>
                <ExportButtons screeningId={s.id} onDone={history.reload} compact />
              </li>
            ))}
          </ul>
          <p className="sc-hint">{DISCLAIMER}</p>
        </>
      )}

      {history.data?.reports.length > 0 && (
        <div className="rp-history">
          <h3 className="rp-history__title">Recent downloads</h3>
          <ul>
            {history.data.reports.map((r) => (
              <li key={r.id}>{r.format.toUpperCase()} · {formatDate(r.createdAt)} · by {r.generatedBy}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
