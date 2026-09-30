import React, { useState } from 'react'
import TierPill from './TierPill'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { TIER_COPY } from '../../lib/screeningCopy'
import './clinical.css'

/**
 * Clinician actions on a screening: annotate, override the risk tier (reason required — both
 * values are kept and audited), and mark reviewed. Read-only once REVIEWED or for therapists.
 * Props: screening, canAct, onChange(updatedScreening)
 */
export default function ReviewPanel({ screening, canAct, onChange }) {
  const review = screening.clinicianReview || { annotations: [], override: null }
  const locked = screening.status === 'REVIEWED'
  const editable = canAct && !locked

  const [note, setNote] = useState('')
  const [tier, setTier] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function call(kind, path, body) {
    setBusy(kind); setError('')
    try {
      const { screening: updated } = await api.post(`/api/screenings/${screening.id}/${path}`, body)
      onChange(updated)
      return true
    } catch (err) { setError(err.message); return false } finally { setBusy('') }
  }

  const tierOptions = ['low', 'medium', 'high'].filter((t) => t !== screening.riskTier)

  return (
    <section className="cl-card" aria-labelledby="rv-h">
      <h2 id="rv-h">Clinical review</h2>

      <div>
        <h3 style={{ fontSize: '.9rem', fontFamily: 'var(--font-ui)' }}>Risk tier</h3>
        <p style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          Questionnaire (M-CHAT-R rules): <TierPill tier={screening.riskTier} />
          {review.override && <>→ Clinician: <TierPill tier={review.override.riskTier} /></>}
        </p>
        {review.override && (
          <p className="sc-muted">Overridden {formatDateTime(review.override.at)} — reason: {review.override.reason}</p>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '.9rem', fontFamily: 'var(--font-ui)' }}>Annotations</h3>
        {review.annotations.length === 0 ? <p className="sc-muted">No annotations yet.</p> : (
          <ul className="cl-notes">
            {review.annotations.map((a) => <li key={a._id || a.at} className="cl-note">{a.text}<small>{formatDateTime(a.at)}</small></li>)}
          </ul>
        )}
      </div>

      {error && <div className="status-box status-box--error" role="alert">{error}</div>}

      {editable && (
        <>
          <form className="cl-form" onSubmit={async (e) => { e.preventDefault(); if (await call('note', 'annotations', { text: note })) setNote('') }}>
            <label htmlFor="rv-note">Add annotation</label>
            <textarea id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            <button type="submit" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} disabled={!note.trim() || !!busy}>{busy === 'note' ? 'Saving…' : 'Add annotation'}</button>
          </form>

          <form className="cl-form" onSubmit={async (e) => { e.preventDefault(); if (await call('override', 'override', { riskTier: tier, reason })) { setTier(''); setReason('') } }}>
            <label htmlFor="rv-tier">Change risk tier (your clinical judgement overrides the questionnaire score)</label>
            <select id="rv-tier" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">Choose a tier…</option>
              {tierOptions.map((t) => <option key={t} value={t}>{TIER_COPY[t].label}</option>)}
            </select>
            <label htmlFor="rv-reason">Reason (required — visible to the caregiver once reviewed)</label>
            <textarea id="rv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} required />
            <button type="submit" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} disabled={!tier || reason.trim().length < 5 || !!busy}>{busy === 'override' ? 'Saving…' : 'Save override'}</button>
          </form>

          <div className="cl-form">
            {confirming ? (
              <div className="status-box status-box--notice" role="alertdialog" aria-label="Confirm review">
                <div>
                  <p>Mark this screening as reviewed? The caregiver will then see the final tier{review.override ? ' and your reason' : ''}, and approved insights. This can't be undone.</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn btn--primary" disabled={!!busy} onClick={() => call('review', 'review')}>{busy === 'review' ? 'Saving…' : 'Yes, mark reviewed'}</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--primary" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirming(true)}>Mark as reviewed</button>
            )}
          </div>
        </>
      )}

      {locked && <p className="cl-banner" role="status">Reviewed {formatDateTime(review.reviewedAt)}. This case is locked.</p>}
      {!canAct && !locked && <p className="sc-muted">Only clinicians can annotate, override or review a screening.</p>}
    </section>
  )
}
