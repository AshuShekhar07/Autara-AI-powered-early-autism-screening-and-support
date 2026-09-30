import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../lib/format'
import { antecedentLabel, behaviourLabel, consequenceLabel, settingLabel } from '../../lib/behaviourCategories'
import './behaviour.css'

const PAGE = 10

/**
 * Newest-first list of entries with "Load more". Authors can delete their own entries.
 * Props: childId, refreshKey (bump to reload after a new entry)
 */
export default function BehaviourHistory({ childId, refreshKey = 0 }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState(null)
  const [next, setNext] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(async (before) => {
    setBusy(true); setError('')
    try {
      const data = await api.get(`/api/children/${childId}/behaviour-logs`, { limit: PAGE, before })
      setLogs((prev) => (before && prev ? [...prev, ...data.logs] : data.logs))
      setNext(data.nextBefore)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }, [childId])

  useEffect(() => { setLogs(null); load() }, [load, refreshKey])

  async function remove(id) {
    try {
      await api.delete(`/api/children/${childId}/behaviour-logs/${id}`)
      setLogs((prev) => prev.filter((l) => l.id !== id))
      setConfirmId(null)
    } catch (err) { setError(err.message) }
  }

  return (
    <section className="bh-card" aria-labelledby="bh-history-h">
      <h2 className="bh-h2" id="bh-history-h">History</h2>
      {error && <div className="status-box status-box--error" role="alert">{error} <button type="button" className="sc-link-btn" onClick={() => load()}>Retry</button></div>}
      {logs === null && !error && <div role="status" aria-busy="true" className="bh-loading"><div className="spinner spinner--brand" /></div>}
      {logs && logs.length === 0 && (
        <p className="bh-empty" role="status">No entries yet. Log the first one above — it only takes a few taps.</p>
      )}
      {logs && logs.length > 0 && (
        <ul className="bh-list">
          {logs.map((l) => (
            <li key={l.id} className="bh-entry">
              <div className="bh-entry__top">
                <strong>{behaviourLabel(l.behaviour.category)}</strong>
                <span className="bh-pill">Intensity {l.intensity}/5</span>
              </div>
              <p className="bh-entry__abc">
                <span>Before: {antecedentLabel(l.antecedent.category)}</span>
                <span>After: {consequenceLabel(l.consequence.category)}</span>
              </p>
              {l.behaviour.description && <p className="bh-entry__note">{l.behaviour.description}</p>}
              <p className="bh-muted bh-entry__meta">
                {formatDateTime(l.occurredAt)} · {settingLabel(l.setting)}
                {l.durationMinutes ? ` · ${l.durationMinutes} min` : ''} · by {l.loggedByRole}
                {l.loggedBy === user?.uid && (
                  confirmId === l.id
                    ? <> · <button type="button" className="sc-link-btn bh-danger" onClick={() => remove(l.id)}>Confirm delete</button>{' '}
                        <button type="button" className="sc-link-btn" onClick={() => setConfirmId(null)}>Cancel</button></>
                    : <> · <button type="button" className="sc-link-btn" onClick={() => setConfirmId(l.id)} aria-label={`Delete entry from ${formatDateTime(l.occurredAt)}`}>Delete</button></>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {next && <button type="button" className="btn btn--ghost" onClick={() => load(next)} disabled={busy}>{busy ? 'Loading…' : 'Load more'}</button>}
    </section>
  )
}
