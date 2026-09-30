import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import './clinical.css'

/**
 * Session notes for a child. Therapists can add notes (canWrite); therapists and clinicians read.
 * Caregivers never see this component's data (the API refuses them).
 */
export default function SessionNotes({ childId, canWrite }) {
  const [notes, setNotes] = useState(null)
  const [next, setNext] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async (before) => {
    setError('')
    try {
      const data = await api.get(`/api/children/${childId}/session-notes`, { limit: 10, before })
      setNotes((prev) => (before && prev ? [...prev, ...data.notes] : data.notes))
      setNext(data.nextBefore)
    } catch (err) { setError(err.message) }
  }, [childId])
  useEffect(() => { setNotes(null); load() }, [load])

  async function add(e) {
    e.preventDefault()
    setBusy(true); setFormError('')
    try {
      const { note } = await api.post(`/api/children/${childId}/session-notes`, { text })
      setNotes((prev) => [note, ...(prev || [])])
      setText('')
    } catch (err) { setFormError(err.message) }
    setBusy(false)
  }

  return (
    <section className="cl-card" aria-labelledby="sn-h">
      <h2 id="sn-h">Session notes</h2>
      {canWrite && (
        <form className="cl-form" onSubmit={add}>
          <label htmlFor="sn-text" className="sc-muted">Add a note about today's session (avoid unnecessary identifying details)</label>
          <textarea id="sn-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
          {formError && <div className="status-box status-box--error" role="alert">{formError}</div>}
          <button type="submit" className="btn btn--primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Save note'}</button>
        </form>
      )}
      {error ? <div role="alert" className="cl-empty">{error} <button type="button" className="sc-link-btn" onClick={() => load()}>Try again</button></div>
      : notes === null ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      : notes.length === 0 ? <p className="cl-empty" role="status">No session notes yet.</p>
      : (
        <ul className="cl-notes">
          {notes.map((n) => <li key={n.id} className="cl-note">{n.text}<small>{n.authorName} · {formatDateTime(n.createdAt)}</small></li>)}
        </ul>
      )}
      {next && <button type="button" className="btn btn--ghost" onClick={() => load(next)}>Load more</button>}
    </section>
  )
}
