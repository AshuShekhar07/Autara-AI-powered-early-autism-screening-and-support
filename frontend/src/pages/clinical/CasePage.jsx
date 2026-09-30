import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import DomainBreakdownChart from '../../components/dashboard/DomainBreakdownChart'
import BehaviourHistory from '../../components/behaviour/BehaviourHistory'
import ReviewPanel from '../../components/clinical/ReviewPanel'
import Timeline from '../../components/clinical/Timeline'
import TierPill from '../../components/clinical/TierPill'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { useJumpToHash } from '../../hooks/useJumpToHash'
import { api } from '../../lib/api'
import { formatAgeMonths, formatDate } from '../../lib/format'
import { DISCLAIMER, STATUS_LABELS } from '../../lib/screeningCopy'
import '../../components/clinical/clinical.css'

const BehaviourCharts = lazy(() => import('../../components/behaviour/BehaviourCharts'))
const Spinner = <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>

/**
 * Case page — /clinician/cases/:id (can review) and /therapist/cases/:id (read-only).
 *
 * All 20 answers with at-risk items highlighted, domain breakdown, behaviour summary + recent logs,
 * timeline, and the review panel. Opening a case as a clinician moves it to UNDER_CLINICAL_REVIEW.
 * Every answer has id="answer-N" and every log id="log-<id>" so evidence links can jump to them.
 */
export default function CasePage() {
  const { screeningId } = useParams()
  const { role } = useAuth()
  const isClinician = role === 'clinician'
  const base = isClinician ? '/clinician' : '/therapist'

  const [screening, setScreening] = useState(null)
  const [error, setError] = useState('')
  const [timelineKey, setTimelineKey] = useState(0)

  const instrument = useApi(() => api.get('/api/screenings/instrument'), [])
  const childId = screening?.childId
  const child = useApi(() => api.get(`/api/children/${childId}`), [childId], !!childId)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let { screening: s } = await api.get(`/api/screenings/${screeningId}`)
        if (isClinician && s.status === 'INSIGHTS_READY') ({ screening: s } = await api.post(`/api/screenings/${screeningId}/open`))
        if (!cancelled) setScreening(s)
      } catch (err) { if (!cancelled) setError(err.message) }
    }
    load()
    return () => { cancelled = true }
  }, [screeningId, isClinician])

  useJumpToHash(!!screening && !!instrument.data)

  function updated(s) { setScreening(s); setTimelineKey((k) => k + 1) }

  if (error) {
    return (
      <DashboardLayout activeNav={isClinician ? 'queue' : 'caseload'} pageTitle="Case">
        <div className="cl-wrap"><div className="cl-card" role="alert"><p>{error}</p><Link to={base} className="btn btn--ghost" style={{ alignSelf: 'flex-start' }}>Back</Link></div></div>
      </DashboardLayout>
    )
  }
  if (!screening || instrument.loading) {
    return <DashboardLayout activeNav={isClinician ? 'queue' : 'caseload'} pageTitle="Case"><div className="cl-wrap">{Spinner}</div></DashboardLayout>
  }
  if (instrument.error) {
    return <DashboardLayout activeNav="queue" pageTitle="Case"><div className="cl-wrap"><div className="cl-card" role="alert">{instrument.error}</div></div></DashboardLayout>
  }

  const items = instrument.data.instrument.items
  const flagged = new Set(screening.atRiskItems)
  const domainLabel = Object.fromEntries(instrument.data.instrument.domains.map((d) => [d.key, d.label]))
  const override = screening.clinicianReview?.override

  return (
    <DashboardLayout activeNav={isClinician ? 'queue' : 'caseload'} pageTitle="Case">
      <div className="cl-wrap">
        <Link to={isClinician ? '/clinician' : `/therapist/children/${screening.childId}`} className="sc-link-btn" style={{ alignSelf: 'flex-start' }}>← {isClinician ? 'Review queue' : 'Child workspace'}</Link>

        <div className="cl-head">
          <div>
            <h1 className="sc-title">{child.data ? child.data.child.name : 'Case'}</h1>
            <p className="sc-muted">
              M-CHAT-R · submitted {formatDate(screening.createdAt)} · age {formatAgeMonths(screening.childAgeMonths)}
              {child.data && <> · <Link to={`${base}/children/${screening.childId}`}>Open child workspace</Link></>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="sr-pill">{STATUS_LABELS[screening.status]}</span>
            <TierPill tier={override?.riskTier || screening.riskTier} />
          </div>
        </div>
        <p className="sr-disclaimer" role="note">{DISCLAIMER}</p>

        <section className="cl-card" aria-labelledby="ans-h">
          <h2 id="ans-h">Answers — {screening.riskScore} of 20 flagged</h2>
          <p className="sc-muted">
            Flagged = counted toward the score by the M-CHAT-R rules (a “No” on most items; a “Yes” on items 2, 5 and 12).
            Questionnaire tier: <TierPill tier={screening.riskTier} />
            {screening.modelProbability != null && <> · Model probability (informational, never changes the tier): {screening.modelProbability.toFixed(2)} <span className="sc-muted">({screening.modelVersion})</span></>}
          </p>
          <ol className="cl-answers">
            {items.map((it) => {
              const isFlag = flagged.has(it.number)
              return (
                <li key={it.number} id={`answer-${it.number}`} className={`cl-answer${isFlag ? ' cl-answer--flag' : ''}`}>
                  <span className="cl-answer__n">{it.number}</span>
                  <span>{it.text}{isFlag && <span className="cl-flag">Flagged</span>}<span className="sc-hint" style={{ display: 'block' }}>Area (Autara grouping): {domainLabel[it.domain]}</span></span>
                  <span className="cl-answer__a">{screening.answers[it.number] === 'yes' ? 'Yes' : 'No'}</span>
                </li>
              )
            })}
          </ol>
        </section>

        <DomainBreakdownChart domains={screening.domainBreakdown} />
        <p className="sc-hint">{instrument.data.instrument.domainGroupingNote}</p>

        {/* AI insight panel is added in Phase 5 (src/components/clinical/InsightPanel.jsx) */}

        <ReviewPanel screening={screening} canAct={isClinician} onChange={updated} />

        <Suspense fallback={Spinner}><BehaviourCharts childId={screening.childId} /></Suspense>
        <BehaviourHistory childId={screening.childId} pageSize={20} canEdit={false} />
        <Timeline childId={screening.childId} refreshKey={timelineKey} />

        <p className="sc-footer">{instrument.data.instrument.copyright} {DISCLAIMER}</p>
      </div>
    </DashboardLayout>
  )
}
