import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DomainBreakdownChart from '../components/dashboard/DomainBreakdownChart'
import { api } from '../lib/api'
import { formatDate, formatAgeMonths } from '../lib/format'
import { DISCLAIMER, TIER_COPY, STATUS_LABELS } from '../lib/screeningCopy'
import './Screening.css'

/**
 * Screening result (caregiver view) — /screenings/:id
 *
 * Explains the risk tier in plain words, what to do next, and WHICH answers contributed
 * (explainability), then invites the caregiver to share with their care team.
 * Never uses the word "diagnosis" except in the disclaimer that says it isn't one.
 */
export default function ScreeningResult() {
  const { id } = useParams()
  const [screening, setScreening]   = useState(null)
  const [instrument, setInstrument] = useState(null)
  const [careTeam, setCareTeam]     = useState(null)
  const [error, setError]           = useState('')
  const [retrying, setRetrying]     = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [s, i] = await Promise.all([api.get(`/api/screenings/${id}`), api.get('/api/screenings/instrument')])
      setScreening(s.screening)
      setInstrument(i.instrument)
      try {
        const ct = await api.get(`/api/children/${s.screening.childId}/care-team`)
        setCareTeam(ct.careTeam)
      } catch { setCareTeam([]) }
    } catch (err) {
      setError(err.message)
    }
  }, [id])
  useEffect(() => { load() }, [load])

  async function retry() {
    setRetrying(true)
    try {
      const { screening: s } = await api.post(`/api/screenings/${id}/retry`)
      setScreening(s)
    } catch (err) { setError(err.message) }
    setRetrying(false)
  }

  if (error) {
    return (
      <DashboardLayout activeNav="history" pageTitle="Screening result">
        <div className="sc-wrap"><div className="sc-card sc-card--center" role="alert">
          <h1 className="sc-title">Couldn't load this result</h1>
          <p className="sc-muted">{error}</p>
          <button type="button" className="btn btn--ghost" onClick={load}>Try again</button>
        </div></div>
      </DashboardLayout>
    )
  }
  if (!screening || !instrument) {
    return (
      <DashboardLayout activeNav="history" pageTitle="Screening result">
        <div className="sc-wrap"><div className="sc-card sc-card--center" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div></div>
      </DashboardLayout>
    )
  }

  if (screening.status === 'PROCESSING_FAILED' || screening.status === 'PROCESSING') {
    return (
      <DashboardLayout activeNav="history" pageTitle="Screening result">
        <div className="sc-wrap"><div className="sc-card sc-card--center">
          <h1 className="sc-title">Your answers are saved</h1>
          <p className="sc-muted">We couldn't calculate the result just now. Nothing is lost — you can try again.</p>
          <button type="button" className="btn btn--primary" onClick={retry} disabled={retrying}>
            {retrying ? 'Trying…' : 'Try again'}
          </button>
        </div></div>
      </DashboardLayout>
    )
  }

  const tier = screening.effectiveRiskTier || screening.riskTier
  const copy = TIER_COPY[tier]
  const reviewed = screening.status === 'REVIEWED'
  const override = screening.clinicianReview?.override
  const itemByNumber = Object.fromEntries(instrument.items.map((it) => [it.number, it]))
  const domainLabel = Object.fromEntries(instrument.domains.map((d) => [d.key, d.label]))

  return (
    <DashboardLayout activeNav="history" pageTitle="Screening result">
      <div className="sc-wrap">
        <div className="sc-card">
          <div className={`sr-tier sr-tier--${tier}`}>
            <span className="sr-tier__badge">
              {copy.label} · M-CHAT-R screening · {formatDate(screening.createdAt)} · age {formatAgeMonths(screening.childAgeMonths)}
            </span>
            <h1 className="sr-tier__headline">{copy.headline}</h1>
            <p>{copy.meaning}</p>
            <span className={`sr-pill${reviewed ? ' sr-pill--ok' : ''}`}>{STATUS_LABELS[screening.status]}</span>
          </div>

          {reviewed && override && (
            <div className="status-box status-box--notice" role="note">
              <div>
                <strong>A clinician adjusted this result.</strong> The questionnaire score alone gave a
                &ldquo;{TIER_COPY[override.originalTier]?.label}&rdquo; result; after review the clinician
                recorded &ldquo;{TIER_COPY[override.riskTier]?.label}&rdquo;. Reason: {override.reason}
              </div>
            </div>
          )}

          <div className="sr-next">
            <h2>Recommended next step</h2>
            <p>{copy.next}</p>
          </div>

          <p className="sr-disclaimer" role="note">{DISCLAIMER}</p>
        </div>

        <div className="sc-card sr-section">
          <h2>Which answers contributed</h2>
          <p className="sc-muted">
            {screening.riskScore} of {instrument.items.length} answers were flagged. A flagged answer is one that
            the questionnaire's scoring rules count toward the result — it is not a judgement about your child.
          </p>
          {screening.atRiskItems.length === 0 ? (
            <p>No answers were flagged.</p>
          ) : (
            <ul className="sr-flagged">
              {screening.atRiskItems.map((n) => (
                <li key={n}>
                  <strong>Question {n}:</strong> {itemByNumber[n]?.text}
                  <span className="sr-flagged__meta">
                    You answered <strong>{screening.answers[n] === 'yes' ? 'Yes' : 'No'}</strong>
                    {' · '}Area: {domainLabel[itemByNumber[n]?.domain]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DomainBreakdownChart domains={screening.domainBreakdown} />
        <p className="sc-hint">{instrument.domainGroupingNote}</p>

        <div className="sc-card sr-section">
          <h2>Share with your care team</h2>
          {careTeam && careTeam.length > 0 ? (
            <>
              <p>These professionals can already see this screening in their Autara workspace:</p>
              <ul className="sc-list">
                {careTeam.map((m) => <li key={m.uid}>{m.name} <span className="sc-muted">({m.role}{m.orgName ? `, ${m.orgName}` : ''})</span></li>)}
              </ul>
              <p className="sc-muted">Insights written by Autara's AI appear for you only after a clinician has reviewed them.</p>
            </>
          ) : (
            <>
              <p>No one else can see this yet. Add your child's therapist or clinician to your care team and they'll be able to review it.</p>
              <Link to="/dashboard#care-team" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }}>Add a professional</Link>
            </>
          )}
        </div>

        <div className="sc-actions">
          <Link to="/dashboard" className="btn btn--ghost">Back to dashboard</Link>
          <Link to="/behaviour" className="btn btn--ghost">Log a behaviour</Link>
        </div>
        <p className="sc-footer">{instrument.copyright} {DISCLAIMER}</p>
      </div>
    </DashboardLayout>
  )
}
