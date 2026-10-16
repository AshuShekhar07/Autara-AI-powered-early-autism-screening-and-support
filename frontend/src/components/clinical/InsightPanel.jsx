import React, { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { DISCLAIMER } from '../../lib/screeningCopy'
import './clinical.css'

const FAILURE_TEXT = {
  LLM_NOT_CONFIGURED: 'The AI model is not configured (no API key).',
  LLM_ERROR: 'The AI model could not be reached.',
  INVALID_JSON: 'The AI reply was not valid.',
  EMPTY_UNCERTAINTY: 'The AI reply left out its uncertainty statement.',
}
function failureText(code) {
  if (FAILURE_TEXT[code]) return FAILURE_TEXT[code]
  if (code.startsWith('BANNED_PHRASE')) return 'The AI reply contained wording that suggests a diagnosis, so it was blocked.'
  if (code.startsWith('UNKNOWN_EVIDENCE_ID')) return 'The AI cited evidence that does not exist, so it was blocked.'
  if (code.startsWith('UNKNOWN_REFERENCE')) return 'The AI cited a source that was not retrieved, so it was blocked.'
  if (code.startsWith('SCHEMA_MISMATCH')) return 'The AI reply did not have the required structure.'
  return code
}

/** A link that jumps to the exact answer / behaviour log that supports a claim. */
function EvidenceLink({ ev }) {
  const href = ev.type === 'screening_response' ? `#answer-${ev.id}` : `#log-${ev.id}`
  const label = ev.type === 'screening_response' ? `Answer ${ev.id}` : 'Behaviour log'
  return <a href={href} className="in-ev" title={ev.type === 'screening_response' ? `Jump to answer ${ev.id}` : 'Jump to this behaviour log entry'}>{label}</a>
}

function InsightBody({ insight }) {
  return (
    <div className="in-body">
      <div>
        <h4 className="in-h">Summary for the clinician</h4>
        <p>{insight.summary}</p>
      </div>

      <div>
        <h4 className="in-h">Flagged areas and the evidence behind them</h4>
        {insight.flaggedAreas.length === 0 ? <p className="sc-muted">No areas were flagged from the supplied evidence.</p> : (
          <ul className="in-areas">
            {insight.flaggedAreas.map((a, i) => (
              <li key={i} className="in-area">
                <strong>{a.area}</strong>
                <p>{a.explanation}</p>
                <p className="in-row"><span className="in-key">Evidence:</span> {a.evidence.map((e) => <EvidenceLink key={`${e.type}-${e.id}`} ev={e} />)}</p>
                <p className="in-row">
                  <span className="in-key">Sources:</span>{' '}
                  {a.references.length === 0
                    ? <span className="sc-muted">none — patient evidence only</span>
                    : a.references.map((r, j) => <span key={j} className="in-ref">{r.source}{r.page ? `, p. ${r.page}` : ''}{r.section ? ` — ${r.section}` : ''}</span>)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="in-uncertainty">
        <h4 className="in-h">Uncertainty</h4>
        <p>{insight.uncertainty}</p>
      </div>
    </div>
  )
}

/**
 * AI insight for a screening (clinician case page).
 *  - clinician: generate, read with evidence links + sources + uncertainty, approve for the family
 *  - therapist: read approved insights only
 * The AI never diagnoses; every insight needs clinician review before the family sees any of it.
 */
export default function InsightPanel({ screening, canAct }) {
  const { data, loading, error, reload } = useApi(() => api.get('/api/insights', { screeningId: screening.id }), [screening.id])
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const locked = screening.status === 'REVIEWED'

  const insights = data?.insights || []
  const latest = insights[0] || null
  const older = insights.slice(1)

  async function generate() {
    setBusy('generate'); setActionError('')
    try { await api.post('/api/insights/generate', { screeningId: screening.id }); reload() }
    catch (err) { setActionError(err.message) }
    setBusy('')
  }
  async function approve(id) {
    setBusy('approve'); setActionError('')
    try { await api.post(`/api/insights/${id}/approve`); reload() }
    catch (err) { setActionError(err.message) }
    setBusy('')
  }

  return (
    <section className="cl-card" aria-labelledby="in-h">
      <div className="cl-head">
        <h2 id="in-h">AI insight</h2>
        {canAct && !locked && (
          <button type="button" className="btn btn--primary" onClick={generate} disabled={busy === 'generate'} aria-busy={busy === 'generate'}>
            {busy === 'generate' ? 'Generating… (up to a minute)' : latest ? 'Generate again' : 'Generate AI insight'}
          </button>
        )}
      </div>
      <p className="cl-banner" role="note">
        AI-drafted from the recorded answers and behaviour logs. Clinical review is required — check every claim against its evidence.
        Nothing here reaches the family until you approve it. {DISCLAIMER}
      </p>

      {actionError && <div className="status-box status-box--error" role="alert">{actionError}</div>}

      {loading ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      : error ? <div className="cl-empty" role="alert">{error} <button type="button" className="sc-link-btn" onClick={reload}>Try again</button></div>
      : !latest ? <p className="cl-empty" role="status">{canAct ? 'No insight yet. Generate one to see an evidence-linked explanation of the flagged answers.' : 'No clinician-approved insight for this screening yet.'}</p>
      : (
        <>
          <p style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`sr-pill${latest.status === 'approved' ? ' sr-pill--ok' : ''}`}>
              {latest.status === 'approved' ? 'Approved for the family' : latest.status === 'failed' ? 'Generation failed' : 'Awaiting your approval'}
            </span>
            <span className="sc-muted">{formatDateTime(latest.generatedAt)}{latest.model ? ` · ${latest.model}` : ''}{latest.promptVersion ? ` · ${latest.promptVersion}` : ''}</span>
          </p>

          {latest.status === 'failed' ? (
            <div className="status-box status-box--notice" role="alert">
              <div>
                <strong>No insight was produced.</strong>
                <ul className="sc-list">{latest.failureReasons.map((r) => <li key={r}>{failureText(r)}</li>)}</ul>
                <p className="sc-muted">Nothing unsafe was saved. You can try again or review the case without AI.</p>
              </div>
            </div>
          ) : (
            <>
              <InsightBody insight={latest} />
              <div className="in-family">
                <h4 className="in-h">What the family will see once approved</h4>
                <p>{latest.caregiverSummary}</p>
                {latest.readingGrade != null && latest.readingGrade > 9 && (
                  <p className="sc-hint">Reading level is about grade {latest.readingGrade} (target ≈ 6). Consider whether this is clear enough.</p>
                )}
              </div>
              {canAct && latest.status === 'generated' && (
                <button type="button" className="btn btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => approve(latest.id)} disabled={busy === 'approve'}>
                  {busy === 'approve' ? 'Approving…' : 'Approve for the family'}
                </button>
              )}
            </>
          )}

          {older.length > 0 && (
            <details>
              <summary className="sc-muted">{older.length} earlier attempt{older.length === 1 ? '' : 's'}</summary>
              <ul className="sc-list">{older.map((o) => <li key={o.id}>{formatDateTime(o.generatedAt)} — {o.status}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
