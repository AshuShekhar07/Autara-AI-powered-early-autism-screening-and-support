import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DangerZone from '../components/DangerZone'
import { useAuth } from '../context/AuthContext'
import { isCareRole } from '../lib/roles'
import './ChildProfile.css'

const ROLE_LABEL = { caregiver: 'Caregiver', patient: 'Patient', therapist: 'Therapist', clinician: 'Clinician' }

/**
 * Account settings (/account) for every non-admin role: who you are, whether your email is confirmed,
 * and "Delete my account". Admin accounts are managed through ADMIN_EMAILS instead.
 */
export default function Account() {
  const navigate = useNavigate()
  const { user, role, profileData, resendVerification, refreshEmailVerified, deleteAccount } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')
  const care = isCareRole(role)

  async function resend() {
    setMsg('')
    try { await resendVerification(); setMsg('Confirmation link sent. Check your inbox and spam folder.') }
    catch { setMsg('Could not send right now. Please wait a minute and try again.') }
  }
  async function check() {
    setMsg('')
    const ok = await refreshEmailVerified().catch(() => false)
    setMsg(ok ? 'Thanks, your email is confirmed.' : "Not confirmed yet. Open the link in the email first.")
  }
  async function remove() {
    await deleteAccount()
    navigate('/login', { replace: true, state: { accountDeleted: true } })
  }

  return (
    <DashboardLayout activeNav="account" pageTitle="Account settings">
      <div className="cppage-container">
        <section className="cppage-card" aria-labelledby="acc-h">
          <h1 className="cppage-card__name" id="acc-h">Account settings</h1>
          <dl className="cppage-details">
            <div className="cppage-detail"><dt>Name</dt><dd>{profileData?.name || '—'}</dd></div>
            <div className="cppage-detail"><dt>Email</dt><dd>{profileData?.email || user?.email}</dd></div>
            <div className="cppage-detail"><dt>Account type</dt><dd>{ROLE_LABEL[role] || role}</dd></div>
            <div className="cppage-detail">
              <dt>Email confirmed</dt>
              <dd>
                {profileData?.emailVerified === false
                  ? <>Not yet · <button type="button" className="sc-link-btn" onClick={resend}>Send link again</button>
                      <button type="button" className="sc-link-btn" onClick={check}>I've confirmed it</button></>
                  : 'Yes'}
              </dd>
            </div>
          </dl>
          {msg && <p className="sc-muted" role="status">{msg}</p>}
          {!deleting && (
            <div>
              <button type="button" className="btn btn--danger-ghost" onClick={() => setDeleting(true)}>Delete my account</button>
            </div>
          )}
        </section>

        {deleting && (
          <DangerZone
            title="Delete your Autara account?"
            confirmWord="DELETE"
            buttonLabel="Delete my account permanently"
            onConfirm={remove}
            onCancel={() => setDeleting(false)}
          >
            {care ? (
              <p>This permanently deletes your account and <strong>all your children's profiles and records</strong>: screenings, behaviour logs, session notes, AI summaries and report history. Download any reports you want to keep first.</p>
            ) : (
              <p>This permanently deletes your account and removes you from every child's care team. Notes and reviews you wrote stay in those children's records for their families and other professionals.</p>
            )}
            <p>You will be signed out. This cannot be undone.</p>
          </DangerZone>
        )}
      </div>
    </DashboardLayout>
  )
}
