import React, { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import '../../components/clinical/clinical.css'

const PAGE_SIZE = 20

function VerificationQueue() {
  const { data, loading, error, reload } = useApi(() => api.get('/api/admin/users', { status: 'pending', limit: 50 }), [])
  const [busyUid, setBusyUid] = useState('')
  const [actionError, setActionError] = useState('')

  async function decide(uid, verified) {
    setBusyUid(uid); setActionError('')
    try { await api.patch(`/api/admin/users/${uid}/verify`, { verified }); reload() }
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
            <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Organisation</th><th scope="col">Licence number</th><th scope="col">Signed up</th><th scope="col"><span className="bh-sr">Decision</span></th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.uid}>
                  <th scope="row" style={{ fontWeight: 600 }}>{u.name}<span className="sc-hint" style={{ display: 'block', fontWeight: 400 }}>{u.email}</span></th>
                  <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                  <td>{u.orgName || '—'}</td>
                  <td><code>{u.licenseNumber || '—'}</code></td>
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

function UserList() {
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
    try { await api.patch(`/api/admin/users/${u.uid}/verify`, { verified: !u.verified }); reload() } catch { /* shown via reload error */ }
    setBusyUid('')
  }, [reload])

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
              <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Signed up</th><th scope="col"><span className="bh-sr">Action</span></th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.uid}>
                    <th scope="row" style={{ fontWeight: 600 }}>{u.name}<span className="sc-hint" style={{ display: 'block', fontWeight: 400 }}>{u.email}</span></th>
                    <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                    <td>{u.verificationStatus ? <span className="sr-pill">{u.verificationStatus}</span> : <span className="sc-muted">n/a</span>}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{['therapist', 'clinician'].includes(u.role) && (
                      <button type="button" className="sc-link-btn" disabled={busyUid === u.uid} onClick={() => toggle(u)}>{u.verified ? 'Revoke' : 'Approve'}</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

/** /admin — verification queue and user list. (Anonymised analytics are added in Phase 6.) */
export default function AdminDashboard() {
  return (
    <DashboardLayout activeNav="admin" pageTitle="Admin console">
      <div className="cl-wrap">
        <div>
          <h1 className="sc-title">Admin console</h1>
          <p className="sc-muted">Administrators verify professionals and see anonymised, aggregate usage. Individual children's data is never shown here.</p>
        </div>
        <VerificationQueue />
        <UserList />
      </div>
    </DashboardLayout>
  )
}
