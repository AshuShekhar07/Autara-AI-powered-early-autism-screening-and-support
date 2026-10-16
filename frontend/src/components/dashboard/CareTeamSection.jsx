import React, { useState } from 'react'
import { useChildren } from '../../context/ChildContext'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { initialsOf } from '../../lib/format'
import './CareTeamSection.css'

/**
 * CareTeamSection — the active child's care team (GET /api/children/:id/care-team).
 * A caregiver adds a VERIFIED therapist/clinician by email and can remove them again.
 * Everyone on the care team can see the child's screenings and behaviour data.
 */
export default function CareTeamSection() {
  const { activeChild, refresh } = useChildren()
  const childId = activeChild?.id
  const { data, loading, error, reload } = useApi(
    () => api.get(`/api/children/${childId}/care-team`), [childId], !!childId
  )
  const team = data?.careTeam || []

  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmUid, setConfirmUid] = useState(null)

  async function add(e) {
    e.preventDefault()
    setBusy(true); setFormError('')
    try {
      await api.post(`/api/children/${childId}/care-team`, { email })
      setEmail(''); setAdding(false)
      reload(); refresh()
    } catch (err) { setFormError(err.message) }
    setBusy(false)
  }

  async function remove(uid) {
    setBusy(true); setFormError('')
    try {
      await api.delete(`/api/children/${childId}/care-team/${uid}`)
      setConfirmUid(null)
      reload(); refresh()
    } catch (err) { setFormError(err.message) }
    setBusy(false)
  }

  return (
    <section className="ct-section" id="care-team" aria-labelledby="ct-heading">
      <div className="ct-section__header">
        <h2 className="ct-section__title" id="ct-heading">Care Team</h2>
        <p className="ct-section__sub">
          {activeChild ? `Professionals who can see ${activeChild.name}'s screenings and behaviour logs` : "Your child's care team"}
        </p>
      </div>

      {!activeChild ? null : loading ? (
        <div className="ct-empty" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      ) : error ? (
        <div className="ct-empty" role="alert">
          <p className="ct-empty__title">Couldn't load your care team</p>
          <p className="ct-empty__body">{error}</p>
          <button type="button" className="ct-connect-btn" onClick={reload}>Try again</button>
        </div>
      ) : team.length === 0 ? (
        <div className="ct-empty" role="status">
          <div className="ct-empty__icon" aria-hidden="true">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="ct-empty__title">No professionals connected yet</p>
          <p className="ct-empty__body">Add a therapist or clinician to collaborate on your child's support journey.</p>
        </div>
      ) : (
        <ul className="ct-list" role="list">
          {team.map((pro) => (
            <li key={pro.uid} className="ct-professional">
              <div className="ct-avatar" aria-hidden="true" title={pro.name}>{initialsOf(pro.name)}</div>
              <div className="ct-professional__info">
                <span className="ct-professional__name">{pro.name}</span>
                <span className="ct-professional__role">{pro.role === 'clinician' ? 'Clinician' : 'Therapist'}{pro.orgName ? ` · ${pro.orgName}` : ''}</span>
              </div>
              {confirmUid === pro.uid ? (
                <span className="ct-confirm">
                  <button type="button" className="sc-link-btn bh-danger" onClick={() => remove(pro.uid)} disabled={busy}>Remove</button>
                  <button type="button" className="sc-link-btn" onClick={() => setConfirmUid(null)}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="sc-link-btn" onClick={() => setConfirmUid(pro.uid)} aria-label={`Remove ${pro.name} from the care team`}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {activeChild && (
        <div className="ct-section__footer">
          {adding ? (
            <form onSubmit={add} className="ct-form" noValidate>
              <label htmlFor="ct-email">Professional's email</label>
              <input id="ct-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@clinic.example" required />
              <p className="sc-hint">They must have an Autara account that has been verified by our team.</p>
              {formError && <div className="status-box status-box--error" role="alert">{formError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="ct-connect-btn" disabled={busy || !email.trim()}>{busy ? 'Adding…' : 'Add to care team'}</button>
                <button type="button" className="sc-link-btn" onClick={() => { setAdding(false); setFormError('') }}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" className="ct-connect-btn" onClick={() => setAdding(true)} aria-label="Add a professional to your child's care team">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add a Professional
            </button>
          )}
          {!adding && formError && <div className="status-box status-box--error" role="alert">{formError}</div>}
        </div>
      )}
    </section>
  )
}
