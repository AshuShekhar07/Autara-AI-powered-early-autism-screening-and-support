import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDate, formatDateTime } from '../../lib/format'
import '../../components/clinical/clinical.css'

const AnalyticsSection = lazy(() => import('../../components/admin/AnalyticsSection'))

const PAGE_SIZE = 20

function VerificationQueue({ onChanged }) {
  const { data, loading, error, reload } = useApi(() => api.get('/api/admin/users', { status: 'pending', limit: 50 }), [])
  const [busyUid, setBusyUid] = useState('')
  const [actionError, setActionError] = useState('')

  async function decide(uid, verified) {
    setBusyUid(uid); setActionError('')
    try { await api.patch(`/api/admin/users/${uid}/verify`, { verified }); reload(); onChanged?.() }
    catch (err) { setActionError(err.message) }
    setBusyUid('')
  }

  return (
    <section className="cl-card" aria-labelledby="vq-h">
      <h2 id="vq-h">Pending verification{data ? ` (${data.total})` : ''}</h2>
      <p className="sc-muted">Check each licence number with the issuing body before approving. Approved professionals can be added to care teams and see their children's data.</p>
      {actionError && <div className="status-box status-box--error" role="alert">{actionError}</div>}
      {loading ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      : error ? <div className="cl-empty" role="alert">{error} <button type="button" className="sc-link-btn" onClick={reload}>Try again</button></div>
      : data.users.length === 0 ? <p className="cl-empty" role="status">No accounts are waiting for verification.</p>
      : (
        <div className="cl-tablewrap">
          <table className="cl-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Organisation</th><th scope="col">Licence number</th><th scope="col">Email confirmed</th><th scope="col">Signed up</th><th scope="col"><span className="bh-sr">Decision</span></th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.uid}>
                  <th scope="row" style={{ fontWeight: 600 }}>{u.name}<span className="sc-hint" style={{ display: 'block', fontWeight: 400 }}>{u.email}</span></th>
                  <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                  <td>{u.orgName || '—'}</td>
                  <td><code>{u.licenseNumber || '—'}</code></td>
                  <td>{u.emailVerified ? 'Yes' : <span className="cl-flag">Not yet</span>}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn--primary" style={{ padding: '6px 12px', fontSize: '.8rem' }} disabled={busyUid === u.uid} onClick={() => decide(u.uid, true)} aria-label={`Approve ${u.name}`}>Approve</button>
                      <button type="button" className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: '.8rem' }} disabled={busyUid === u.uid} onClick={() => decide(u.uid, false)} aria-label={`Reject ${u.name}`}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function UserList({ onChanged }) {
  const [role, setRole] = useState('')
  const [verified, setVerified] = useState('')
  const [page, setPage] = useState(1)
  const params = { role, verified, page, limit: PAGE_SIZE }
  const { data, loading, error, reload } = useApi(() => api.get('/api/admin/users', params), [role, verified, page])

  useEffect(() => { setPage(1) }, [role, verified])
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const [busyUid, setBusyUid] = useState('')
  const toggle = useCallback(async (u) => {
    setBusyUid(u.uid)
    try { await api.patch(`/api/admin/users/${u.uid}/verify`, { verified: !u.verified }); reload(); onChanged?.() } catch { /* shown via reload error */ }
    setBusyUid('')
  }, [reload, onChanged])

  const [confirmUid, setConfirmUid] = useState('')
  const [actionError, setActionError] = useState('')
  const setDisabled = useCallback(async (u, disabled) => {
    setBusyUid(u.uid); setActionError('')
    try { await api.patch(`/api/admin/users/${u.uid}/disabled`, { disabled }); setConfirmUid(''); reload(); onChanged?.() }
    catch (err) { setActionError(err.message) }
    setBusyUid('')
  }, [reload, onChanged])

  return (
    <section className="cl-card" aria-labelledby="ul-h">
      <h2 id="ul-h">Users</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 160 }}>
          <label htmlFor="f-role">Role</label>
          <select id="f-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {['caregiver', 'patient', 'therapist', 'clinician', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label htmlFor="f-ver">Verification</label>
          <select id="f-ver" value={verified} onChange={(e) => setVerified(e.target.value)}>
            <option value="">All</option><option value="true">Verified</option><option value="false">Not verified</option>
          </select>
        </div>
      </div>

      {loading ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      : error ? <div className="cl-empty" role="alert">{error} <button type="button" className="sc-link-btn" onClick={reload}>Try again</button></div>
      : data.users.length === 0 ? <p className="cl-empty" role="status">No users match these filters.</p>
      : (
        <>
          <div className="cl-tablewrap">
            <table className="cl-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Email confirmed</th><th scope="col">Signed up</th><th scope="col"><span className="bh-sr">Actions</span></th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.uid}>
                    <th scope="row" style={{ fontWeight: 600 }}>{u.name}<span className="sc-hint" style={{ display: 'block', fontWeight: 400 }}>{u.email}</span></th>
                    <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                    <td>
                      {u.disabled && <span className="cl-tier cl-tier--high" style={{ marginRight: 6 }}>Disabled</span>}
                      {u.verificationStatus ? <span className="sr-pill">{u.verificationStatus}</span> : !u.disabled && <span className="sc-muted">active</span>}
                    </td>
                    <td>{u.emailVerified ? 'Yes' : 'Not yet'}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {['therapist', 'clinician'].includes(u.role) && !u.disabled && (
                          <button type="button" className="sc-link-btn" disabled={busyUid === u.uid} onClick={() => toggle(u)}>{u.verified ? 'Revoke' : 'Approve'}</button>
                        )}
                        {u.role !== 'admin' && (u.disabled
                          ? <button type="button" className="sc-link-btn" disabled={busyUid === u.uid} onClick={() => setDisabled(u, false)} aria-label={`Enable ${u.name}`}>Enable</button>
                          : confirmUid === u.uid
                            ? <>
                                <button type="button" className="btn btn--danger" style={{ padding: '5px 10px', fontSize: '.78rem' }} disabled={busyUid === u.uid} onClick={() => setDisabled(u, true)} aria-label={`Yes, disable ${u.name}`}>Yes, disable</button>
                                <button type="button" className="sc-link-btn" onClick={() => setConfirmUid('')}>Cancel</button>
                              </>
                            : <button type="button" className="sc-link-btn" onClick={() => setConfirmUid(u.uid)} aria-label={`Disable ${u.name}`}>Disable</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {actionError && <div className="status-box status-box--error" role="alert">{actionError}</div>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="sc-muted">{data.total} user{data.total === 1 ? '' : 's'} · page {page} of {totalPages}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button type="button" className="btn btn--ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </span>
          </div>
        </>
      )}
    </section>
  )
}

const ACTION_LABELS = {
  USER_VERIFIED: 'Professional approved', USER_VERIFICATION_REVOKED: 'Professional rejected / revoked',
  USER_DISABLED: 'User disabled', USER_ENABLED: 'User enabled', ADMIN_CREATED: 'Admin account created',
  ADMIN_PROMOTED: 'Account made admin', ADMIN_ACCESS_DENIED: 'Admin login refused', ADMIN_SEEDED: 'Admin set by script',
  ACCOUNT_DELETED: 'Account deleted', CHILD_DELETED: 'Child deleted',
}
const label = (a) => ACTION_LABELS[a] || a.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** Audit log viewer: who did what, newest first. Rows carry ids and counts only (no child details). */
function AuditLog({ refreshKey }) {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApi(() => api.get('/api/admin/audit', { action, page, limit: PAGE_SIZE }), [action, page, refreshKey])
  useEffect(() => { setPage(1) }, [action])
  const entries = data?.entries || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const details = (e) => Object.entries(e.meta || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')

  return (
    <section className="cl-card" aria-labelledby="al-h">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 id="al-h">Audit log</h2>
        <button type="button" className="sc-link-btn" onClick={reload}>Refresh</button>
      </div>
      <p className="sc-muted">Every sensitive action (approvals, reviews, overrides, exports, deletions, admin actions) is recorded here. Entries show ids and counts, never children's details.</p>
      <div className="field" style={{ maxWidth: 280 }}>
        <label htmlFor="f-action">Action</label>
        <select id="f-action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {(data?.actions || []).map((a) => <option key={a} value={a}>{label(a)}</option>)}
        </select>
      </div>
      {loading ? <div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>
      : error ? <div className="cl-empty" role="alert">{error} <button type="button" className="sc-link-btn" onClick={reload}>Try again</button></div>
      : entries.length === 0 ? <p className="cl-empty" role="status">Nothing recorded yet.</p>
      : (
        <>
          <div className="cl-tablewrap" tabIndex={0} role="region" aria-label="Audit log entries">
            <table className="cl-table">
              <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">By</th><th scope="col">On</th><th scope="col">Details</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</td>
                    <th scope="row" style={{ fontWeight: 600 }}>{label(e.action)}</th>
                    <td>{e.actorName}<span className="sc-hint" style={{ display: 'block' }}>{e.actorRole}</span></td>
                    <td>{e.targetType}<span className="sc-hint" style={{ display: 'block' }}><code>{e.targetId}</code></span></td>
                    <td className="sc-muted" style={{ fontSize: '.8rem' }}>{details(e) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="sc-muted">{total} entr{total === 1 ? 'y' : 'ies'} · page {page} of {totalPages}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</button>
              <button type="button" className="btn btn--ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Older</button>
            </span>
          </div>
        </>
      )}
    </section>
  )
}

/** /admin — verification queue, anonymised analytics, the user list and the audit log. */
export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)          // bumps after every admin action → audit log reloads
  const changed = useCallback(() => setRefreshKey((k) => k + 1), [])
  return (
    <DashboardLayout activeNav="admin" pageTitle="Admin console">
      <div className="cl-wrap">
        <div>
          <h1 className="sc-title">Admin console</h1>
          <p className="sc-muted">Administrators verify professionals and see anonymised, aggregate usage. Individual children's data is never shown here.</p>
        </div>
        <VerificationQueue onChanged={changed} />
        <Suspense fallback={<div className="cl-state" role="status" aria-busy="true"><div className="spinner spinner--brand" /></div>}>
          <AnalyticsSection />
        </Suspense>
        <UserList onChanged={changed} />
        <AuditLog refreshKey={refreshKey} />
      </div>
    </DashboardLayout>
  )
}
