import React from 'react'
import { Link } from 'react-router-dom'
import TierPill from './TierPill'
import { formatAgeMonths, formatDate } from '../../lib/format'
import { STATUS_LABELS } from '../../lib/screeningCopy'
import './clinical.css'

/**
 * Caseload list for therapists / clinicians (GET /api/me/caseload).
 * Props: children (rows), basePath ('/therapist' | '/clinician') for links, loading, error, onRetry
 */
export default function CaseloadTable({ rows, basePath, loading, error, onRetry }) {
  if (loading) return <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
  if (error) return <div className="cl-empty" role="alert">Couldn't load the caseload: {error} <button type="button" className="sc-link-btn" onClick={onRetry}>Try again</button></div>
  if (!rows || rows.length === 0) {
    return <p className="cl-empty" role="status">No children on your caseload yet. A caregiver adds you to their child's care team using your account email.</p>
  }
  return (
    <div className="cl-tablewrap">
      <table className="cl-table">
        <thead>
          <tr><th scope="col">Child</th><th scope="col">Age</th><th scope="col">Last log</th><th scope="col">Last screening</th><th scope="col"><span className="bh-sr">Actions</span></th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <th scope="row" style={{ fontWeight: 600 }}>
                <Link to={`${basePath}/children/${c.id}`}>{c.name}</Link>
                {c.awaitingReview && <span className="sr-pill" style={{ marginLeft: 8 }}>Needs review</span>}
              </th>
              <td>{formatAgeMonths(c.ageMonths)}</td>
              <td>{c.lastLogAt ? formatDate(c.lastLogAt) : <span className="sc-muted">None yet</span>}</td>
              <td>
                {c.lastScreening
                  ? <><TierPill tier={c.lastScreening.tier} /> <span className="sc-muted">{formatDate(c.lastScreening.createdAt)} · {STATUS_LABELS[c.lastScreening.status]}</span></>
                  : <span className="sc-muted">None yet</span>}
              </td>
              <td><Link to={`${basePath}/children/${c.id}`} className="btn btn--ghost" style={{ padding: '6px 14px', fontSize: '.8rem' }}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
