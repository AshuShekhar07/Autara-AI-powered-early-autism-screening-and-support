import React from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import ChildSwitcher from '../components/ChildSwitcher'
import { useChildren } from '../context/ChildContext'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { TIER_COPY, STATUS_LABELS } from '../lib/screeningCopy'
import './Screening.css'

/** /history — every screening for the active child, newest first. */
export default function History() {
  const { activeChild } = useChildren()
  const { data, loading, error, reload } = useApi(
    () => api.get('/api/screenings', { childId: activeChild.id, limit: 50 }), [activeChild?.id], !!activeChild
  )
  const screenings = data?.screenings || []

  return (
    <DashboardLayout activeNav="history" pageTitle="History">
      <div className="sc-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="sc-title">Screening history</h1>
          <ChildSwitcher />
        </div>
        <div className="sc-card">
          {!activeChild ? <p className="sc-muted">Add a child to see screenings.</p>
          : loading ? <div role="status" aria-busy="true" style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner spinner--brand" /></div>
          : error ? <div role="alert"><p>{error}</p><button type="button" className="btn btn--ghost" onClick={reload}>Try again</button></div>
          : screenings.length === 0 ? (
            <div role="status" style={{ textAlign: 'center' }}>
              <p className="sc-muted">No screenings yet.</p>
              <Link to="/screening" className="btn btn--ghost">Start a screening</Link>
            </div>
          ) : (
            <ul className="sh-list">
              {screenings.map((s) => (
                <li key={s.id}>
                  <Link to={`/screenings/${s.id}`} className="sh-row">
                    <span>
                      <strong>{formatDate(s.createdAt)}</strong>
                      <span className="sc-muted"> · M-CHAT-R</span>
                    </span>
                    <span>
                      {s.effectiveRiskTier ? TIER_COPY[s.effectiveRiskTier].label : '—'}
                      <span className="sr-pill" style={{ marginLeft: 8 }}>{STATUS_LABELS[s.status]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
