import React, { Suspense, lazy, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import LogBehaviourForm from '../../components/behaviour/LogBehaviourForm'
import BehaviourHistory from '../../components/behaviour/BehaviourHistory'
import SessionNotes from '../../components/clinical/SessionNotes'
import Timeline from '../../components/clinical/Timeline'
import TierPill from '../../components/clinical/TierPill'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatAgeMonths, formatDate } from '../../lib/format'
import { STATUS_LABELS } from '../../lib/screeningCopy'
import '../../components/clinical/clinical.css'

const BehaviourCharts = lazy(() => import('../../components/behaviour/BehaviourCharts'))
const Spinner = <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>

/**
 * Child workspace for therapists (/therapist/children/:id) and clinicians (/clinician/children/:id).
 *  - therapist: log ABC entries, see trends, write session notes, read screenings (read-only)
 *  - clinician: read everything, open screenings to review them
 */
export default function ChildWorkspace() {
  const { id } = useParams()
  const { role } = useAuth()
  const base = role === 'clinician' ? '/clinician' : '/therapist'
  const isTherapist = role === 'therapist'
  const [tab, setTab] = useState('overview')
  const [logKey, setLogKey] = useState(0)

  const child = useApi(() => api.get(`/api/children/${id}`), [id])
  const screenings = useApi(() => api.get('/api/screenings', { childId: id, limit: 50 }), [id])

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Trends' },
    { id: 'behaviour', label: isTherapist ? 'Log & history' : 'Behaviour log' },
    { id: 'notes', label: 'Session notes' },
    { id: 'screenings', label: 'Screenings' },
  ]

  return (
    <DashboardLayout activeNav={role === 'clinician' ? 'caseload' : 'caseload'} pageTitle="Child workspace">
      <div className="cl-wrap">
        <Link to={role === 'clinician' ? '/clinician/caseload' : '/therapist'} className="sc-link-btn" style={{ alignSelf: 'flex-start' }}>← Caseload</Link>

        {child.loading ? Spinner : child.error ? (
          <div className="cl-card" role="alert"><p>{child.error}</p><Link to={base} className="btn btn--ghost" style={{ alignSelf: 'flex-start' }}>Back</Link></div>
        ) : (
          <>
            <div className="cl-head">
              <div>
                <h1 className="sc-title">{child.data.child.name}</h1>
                <p className="sc-muted">{formatAgeMonths(child.data.child.ageMonths)} old</p>
              </div>
              {isTherapist && <span className="cl-banner">Read-only for screenings · you can log behaviours and session notes</span>}
            </div>

            <div className="cl-tabs" role="tablist" aria-label="Child workspace sections">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className="cl-tab" onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {tab === 'overview' && <Timeline childId={id} refreshKey={logKey} />}

              {tab === 'trends' && <Suspense fallback={Spinner}><BehaviourCharts childId={id} refreshKey={logKey} /></Suspense>}

              {tab === 'behaviour' && (
                <>
                  {isTherapist && <LogBehaviourForm childId={id} onLogged={() => setLogKey((k) => k + 1)} />}
                  <BehaviourHistory childId={id} refreshKey={logKey} canEdit={isTherapist} />
                </>
              )}

              {tab === 'notes' && <SessionNotes childId={id} canWrite={isTherapist} />}

              {tab === 'screenings' && (
                <section className="cl-card" aria-labelledby="scr-h">
                  <h2 id="scr-h">Screenings</h2>
                  {screenings.loading ? Spinner : screenings.error ? <div className="cl-empty" role="alert">{screenings.error}</div>
                  : screenings.data.screenings.length === 0 ? <p className="cl-empty" role="status">No screenings yet.</p>
                  : (
                    <div className="cl-tablewrap">
                      <table className="cl-table">
                        <thead><tr><th scope="col">Date</th><th scope="col">Questionnaire tier</th><th scope="col">Clinician tier</th><th scope="col">Status</th><th scope="col"><span className="bh-sr">Open</span></th></tr></thead>
                        <tbody>
                          {screenings.data.screenings.map((s) => (
                            <tr key={s.id}>
                              <th scope="row" style={{ fontWeight: 600 }}>{formatDate(s.createdAt)}</th>
                              <td><TierPill tier={s.riskTier} /> <span className="sc-muted">{s.riskScore != null ? `${s.riskScore}/20` : ''}</span></td>
                              <td>{s.clinicianReview?.override ? <TierPill tier={s.clinicianReview.override.riskTier} /> : <span className="sc-muted">—</span>}</td>
                              <td>{STATUS_LABELS[s.status]}</td>
                              <td>{s.riskTier && <Link to={`${base}/cases/${s.id}`} className="btn btn--ghost" style={{ padding: '6px 14px', fontSize: '.8rem' }}>{role === 'clinician' ? 'Open case' : 'View'}</Link>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
