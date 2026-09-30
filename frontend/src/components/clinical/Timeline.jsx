import React from 'react'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import './clinical.css'

/** Merged timeline of screenings, reviews, annotations, behaviour logs and session notes. */
export default function Timeline({ childId, limit = 30, refreshKey = 0 }) {
  const { data, loading, error, reload } = useApi(() => api.get(`/api/children/${childId}/timeline`, { limit }), [childId, limit, refreshKey])
  return (
    <section className="cl-card" aria-labelledby="tl-h">
      <h2 id="tl-h">Timeline</h2>
      {loading ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      : error ? <div className="cl-empty" role="alert">{error} <button type="button" className="sc-link-btn" onClick={reload}>Try again</button></div>
      : data.events.length === 0 ? <p className="cl-empty" role="status">Nothing has happened yet.</p>
      : (
        <ol className="cl-timeline">
          {data.events.map((e) => (
            <li key={e.id}><time dateTime={e.at}>{formatDateTime(e.at)}</time><span><strong>{e.title}</strong> — {e.summary}</span></li>
          ))}
        </ol>
      )}
    </section>
  )
}
