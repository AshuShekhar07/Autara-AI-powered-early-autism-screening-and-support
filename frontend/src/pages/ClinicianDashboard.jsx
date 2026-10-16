import React from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import CaseloadTable from '../components/clinical/CaseloadTable'
import TierPill from '../components/clinical/TierPill'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { formatAgeMonths, formatDate } from '../lib/format'
import { STATUS_LABELS } from '../lib/screeningCopy'
import '../components/clinical/clinical.css'

/**
 * Clinician home (/clinician): the review queue — screenings waiting for review on the
 * clinician's caseload, high risk first, then longest-waiting first.
 * With `caseloadOnly` it renders the caseload list instead (/clinician/caseload).
 */
export default function ClinicianDashboard({ caseloadOnly = false }) {
  const queue = useApi(() => api.get('/api/me/review-queue'), [], !caseloadOnly)
  const caseload = useApi(() => api.get('/api/me/caseload'), [], caseloadOnly)

  if (caseloadOnly) {
    return (
      <DashboardLayout activeNav="caseload" pageTitle="Caseload">
        <div className="cl-wrap">
          <h1 className="sc-title">Caseload</h1>
          <section className="cl-card" aria-label="Caseload">
            <CaseloadTable rows={caseload.data?.children} basePath="/clinician" loading={caseload.loading} error={caseload.error} onRetry={caseload.reload} />
          </section>
        </div>
      </DashboardLayout>
    )
  }

  const items = queue.data?.queue || []
  const counts = { high: 0, medium: 0, low: 0 }
  items.forEach((i) => { counts[i.riskTier] += 1 })

  return (
    <DashboardLayout activeNav="queue" pageTitle="Review queue">
      <div className="cl-wrap">
        <div>
          <h1 className="sc-title">Review queue</h1>
          <p className="sc-muted">Screenings waiting for your review. Highest questionnaire risk tier first, then the longest-waiting.</p>
        </div>

        {!queue.loading && !queue.error && (
          <div className="cl-summary" aria-label="Queue summary">
            <div className="cl-stat"><strong>{items.length}</strong><span>waiting</span></div>
            <div className="cl-stat"><strong>{counts.high}</strong><span>higher risk</span></div>
            <div className="cl-stat"><strong>{counts.medium}</strong><span>medium risk</span></div>
            <div className="cl-stat"><strong>{counts.low}</strong><span>lower risk</span></div>
          </div>
        )}

        <section className="cl-card" aria-label="Screenings waiting for review">
          {queue.loading ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
          : queue.error ? <div className="cl-empty" role="alert">{queue.error} <button type="button" className="sc-link-btn" onClick={queue.reload}>Try again</button></div>
          : items.length === 0 ? <p className="cl-empty" role="status">Nothing is waiting for review. New screenings for children on your caseload will appear here.</p>
          : (
            <div className="cl-tablewrap">
              <table className="cl-table">
                <thead><tr><th scope="col">Child</th><th scope="col">Age</th><th scope="col">Questionnaire tier</th><th scope="col">Flagged</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col"><span className="bh-sr">Open</span></th></tr></thead>
                <tbody>
                  {items.map((q) => (
                    <tr key={q.screeningId}>
                      <th scope="row" style={{ fontWeight: 600 }}>{q.childName}</th>
                      <td>{formatAgeMonths(q.childAgeMonths)}</td>
                      <td><TierPill tier={q.riskTier} /></td>
                      <td>{q.riskScore}/20</td>
                      <td>{formatDate(q.submittedAt)} <span className="sc-muted">({q.waitingDays === 0 ? 'today' : `${q.waitingDays}d`})</span></td>
                      <td>{STATUS_LABELS[q.status]}</td>
                      <td><Link to={`/clinician/cases/${q.screeningId}`} className="btn btn--ghost" style={{ padding: '6px 14px', fontSize: '.8rem' }}>Open case</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}
