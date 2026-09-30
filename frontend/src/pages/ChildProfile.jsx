import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import { initialsOf } from '../lib/format'
import { useChildren } from '../context/ChildContext'
import ChildSwitcher from '../components/ChildSwitcher'
import { api } from '../lib/api'
import './ChildProfile.css'

/**
 * Calculates age string from ISO date string.
 * Returns human-readable label or null.
 */
function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const now    = new Date()
  let years    = now.getFullYear() - birth.getFullYear()
  let months   = now.getMonth()    - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (now.getDate() < birth.getDate()) months = Math.max(0, months - 1)
  const parts = []
  if (years  > 0) parts.push(`${years} year${years  > 1 ? 's' : ''}`)
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' ') : 'Less than 1 month'
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ChildAvatar({ name }) {
  return <div className="cppage-avatar" aria-hidden="true">{initialsOf(name)}</div>
}

/** Small controlled form used for both "edit" and "add another child". */
function ChildForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [dob, setDob]   = useState(initial?.dob ? String(initial.dob).slice(0, 10) : '')
  const [sex, setSex]   = useState(initial?.sex || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError("Please enter the child's name."); return }
    if (!dob) { setError('Please enter a date of birth.'); return }
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), dob, sex: sex || null })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="cppage-form" noValidate>
      <div className="field"><label htmlFor="cf-name">Name</label>
        <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" /></div>
      <div className="field"><label htmlFor="cf-dob">Date of birth</label>
        <input id="cf-dob" type="date" value={dob} max={new Date().toISOString().split('T')[0]} onChange={(e) => setDob(e.target.value)} /></div>
      <div className="field"><label htmlFor="cf-sex">Sex (optional)</label>
        <select id="cf-sex" value={sex} onChange={(e) => setSex(e.target.value)}>
          {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select></div>
      {error && <div className="status-box status-box--error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}

/**
 * ChildProfile page (/child-profile)
 * Shows the active child (from the child switcher), lets the caregiver edit it
 * (PATCH /api/children/:id) or add another child (POST /api/children).
 */
export default function ChildProfile() {
  const { activeChild, refresh, setActiveId, loading, error } = useChildren()
  const [mode, setMode] = useState('view') // view | edit | add

  const childName    = activeChild?.name || null
  const ageLabel     = calcAge(activeChild?.dob)
  const dobFormatted = formatDate(activeChild?.dob)

  async function saveEdit(fields) {
    await api.patch(`/api/children/${activeChild.id}`, fields)
    await refresh()
    setMode('view')
  }
  async function saveNew(fields) {
    const { child } = await api.post('/api/children', fields)
    await refresh()
    setActiveId(child.id)
    setMode('view')
  }

  return (
    <DashboardLayout activeNav="dashboard" pageTitle="Child Profile">
      <div className="cppage-container">
        <Link to="/dashboard" className="cppage-back" aria-label="Back to dashboard">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Dashboard
        </Link>

        <ChildSwitcher />

        {loading && !activeChild && <div className="cppage-card" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>}
        {error && <div className="status-box status-box--error" role="alert">Couldn't load children: {error} <button type="button" className="sc-link-btn" onClick={refresh}>Retry</button></div>}

        {mode === 'add' && (
          <section className="cppage-card" aria-labelledby="add-heading">
            <h1 className="cppage-card__name" id="add-heading">Add another child</h1>
            <ChildForm submitLabel="Add child" onSubmit={saveNew} onCancel={() => setMode('view')} />
          </section>
        )}

        {mode !== 'add' && activeChild && (
          <section className="cppage-card" aria-labelledby="cppage-heading">
            <div className="cppage-card__top">
              <ChildAvatar name={childName} />
              <div className="cppage-card__name-block">
                <h1 className="cppage-card__name" id="cppage-heading">{childName}</h1>
                {ageLabel && <span className="cppage-card__age">{ageLabel}</span>}
              </div>
            </div>

            {mode === 'edit' ? (
              <ChildForm initial={activeChild} submitLabel="Save changes" onSubmit={saveEdit} onCancel={() => setMode('view')} />
            ) : (
              <>
                <dl className="cppage-details">
                  <div className="cppage-detail"><dt>Date of Birth</dt><dd>{dobFormatted || <span className="cppage-not-provided">Not provided</span>}</dd></div>
                  <div className="cppage-detail"><dt>Sex</dt><dd>{activeChild.sex ? activeChild.sex : <span className="cppage-not-provided">Not provided</span>}</dd></div>
                  <div className="cppage-detail"><dt>Care team</dt><dd>{activeChild.careTeam.length} professional{activeChild.careTeam.length === 1 ? '' : 's'}</dd></div>
                </dl>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setMode('edit')}>Edit details</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setMode('add')}>Add another child</button>
                </div>
              </>
            )}
          </section>
        )}

        {!loading && !error && !activeChild && mode !== 'add' && (
          <section className="cppage-card">
            <h1 className="cppage-card__name">No child added yet</h1>
            <button type="button" className="btn btn--primary" onClick={() => setMode('add')}>Add a child</button>
          </section>
        )}

        <section className="cppage-quick" aria-label="Quick actions">
          <Link to="/milestones" className="cppage-quick__link">View Developmental Milestones</Link>
          <Link to="/dashboard" className="cppage-quick__link">Return to Dashboard</Link>
        </section>
      </div>
    </DashboardLayout>
  )
}
