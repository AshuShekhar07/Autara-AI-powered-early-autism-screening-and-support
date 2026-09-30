import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() }))
const auth = vi.hoisted(() => ({ role: 'clinician' }))
vi.mock('../../lib/api', () => ({ api, default: api }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'c@x.test' }, role: auth.role, verified: true, profileData: { name: 'Dr Demo' }, logout: vi.fn() }),
}))
vi.mock('../../components/dashboard/NotificationBell', () => ({ default: () => null }))
vi.mock('../../components/behaviour/BehaviourCharts', () => ({ default: () => <div>CHARTS</div> }))
vi.mock('../../components/behaviour/BehaviourHistory', () => ({ default: () => <div>HISTORY</div> }))

import CasePage from './CasePage'
import ClinicianDashboard from '../ClinicianDashboard'
import AdminDashboard from '../admin/AdminDashboard'

const instrument = {
  copyright: 'M-CHAT-R/F © 2009 Diana Robins, Deborah Fein, & Marianne Barton.', domainGroupingNote: 'Autara grouping, not part of the official instrument.',
  items: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, text: `Question text ${i + 1}?`, domain: 'joint_attention' })),
  domains: [{ key: 'joint_attention', label: 'Joint attention', items: [] }],
}
const screening = (over = {}) => ({
  id: 's1', childId: 'c1', status: 'INSIGHTS_READY', riskScore: 3, riskTier: 'medium', childAgeMonths: 22, createdAt: '2026-09-01T10:00:00Z',
  atRiskItems: [1, 7, 9], answers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'yes'])), domainBreakdown: [], modelProbability: 0.42, modelVersion: 'mchatr-lr-x',
  clinicianReview: { annotations: [], override: null, reviewedAt: null }, ...over,
})

function mountCase(role, s = screening()) {
  auth.role = role
  api.get.mockImplementation(async (path) => {
    if (path === '/api/screenings/instrument') return { instrument }
    if (path === '/api/screenings/s1') return { screening: s }
    if (path === '/api/children/c1') return { child: { id: 'c1', name: 'Alex', ageMonths: 22 } }
    if (path.endsWith('/timeline')) return { events: [] }
    throw new Error('unexpected ' + path)
  })
  api.post.mockImplementation(async (path) => {
    if (path.endsWith('/open')) return { screening: { ...s, status: 'UNDER_CLINICAL_REVIEW' } }
    throw new Error('unexpected post ' + path)
  })
  const base = role === 'clinician' ? '/clinician' : '/therapist'
  return render(<MemoryRouter initialEntries={[`${base}/cases/s1`]}><Routes><Route path={`${base}/cases/:screeningId`} element={<CasePage />} /></Routes></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('CasePage (clinician)', () => {
  it('opens the case, highlights flagged answers with ids for evidence links, shows disclaimer and model info', async () => {
    mountCase('clinician')
    expect(await screen.findByText('Question text 7?')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/api/screenings/s1/open')
    const a7 = document.getElementById('answer-7')
    expect(a7).toHaveClass('cl-answer--flag')
    expect(within(a7).getByText('Flagged')).toBeInTheDocument()       // text label, not colour alone
    expect(document.getElementById('answer-2')).not.toHaveClass('cl-answer--flag')
    expect(screen.getAllByText(/screening aid, not a diagnosis/).length).toBeGreaterThan(0)
    expect(screen.getByText(/never changes the tier/)).toBeInTheDocument()
  })

  it('override requires a tier and a reason, then posts both', async () => {
    mountCase('clinician')
    const user = userEvent.setup()
    await screen.findByText('Question text 1?')
    const save = screen.getByRole('button', { name: 'Save override' })
    expect(save).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/Change risk tier/), 'high')
    expect(save).toBeDisabled()                                       // reason still missing
    await user.type(screen.getByLabelText(/Reason \(required/), 'Follow-up interview flagged more items.')
    expect(save).toBeEnabled()

    api.post.mockResolvedValueOnce({ screening: screening({ status: 'UNDER_CLINICAL_REVIEW', clinicianReview: { annotations: [], reviewedAt: null, override: { riskTier: 'high', originalTier: 'medium', reason: 'Follow-up interview flagged more items.', at: '2026-09-02T10:00:00Z' } } }) })
    await user.click(save)
    expect(api.post).toHaveBeenLastCalledWith('/api/screenings/s1/override', { riskTier: 'high', reason: 'Follow-up interview flagged more items.' })
    expect(await screen.findByText(/reason: Follow-up interview flagged more items\./)).toBeInTheDocument()
  })

  it('mark reviewed asks for confirmation first', async () => {
    mountCase('clinician')
    const user = userEvent.setup()
    await screen.findByText('Question text 1?')
    await user.click(screen.getByRole('button', { name: 'Mark as reviewed' }))
    expect(api.post).not.toHaveBeenCalledWith('/api/screenings/s1/review', expect.anything())
    api.post.mockResolvedValueOnce({ screening: screening({ status: 'REVIEWED', clinicianReview: { annotations: [], override: null, reviewedAt: '2026-09-03T10:00:00Z' } }) })
    await user.click(screen.getByRole('button', { name: 'Yes, mark reviewed' }))
    expect(await screen.findByText(/This case is locked/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save override' })).not.toBeInTheDocument()
  })

  it('shows API errors from review actions', async () => {
    mountCase('clinician')
    const user = userEvent.setup()
    await screen.findByText('Question text 1?')
    api.post.mockRejectedValueOnce(new Error('Please give a reason.'))
    await user.type(screen.getByLabelText('Add annotation'), 'A note')
    await user.click(screen.getByRole('button', { name: 'Add annotation' }))
    expect(await screen.findByText('Please give a reason.')).toBeInTheDocument()
  })
})

describe('CasePage (therapist)', () => {
  it('is read-only: no open call, no override / review controls', async () => {
    mountCase('therapist')
    expect(await screen.findByText('Question text 7?')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save override' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).not.toBeInTheDocument()
    expect(screen.getByText(/Only clinicians can annotate, override or review/)).toBeInTheDocument()
  })
})

describe('Review queue', () => {
  it('lists cases with tier + waiting time and links to the case', async () => {
    auth.role = 'clinician'
    api.get.mockResolvedValue({ queue: [{ screeningId: 's9', childId: 'c1', childName: 'Alex', childAgeMonths: 22, riskTier: 'high', riskScore: 11, status: 'INSIGHTS_READY', submittedAt: '2026-09-01T10:00:00Z', waitingDays: 4 }] })
    render(<MemoryRouter><ClinicianDashboard /></MemoryRouter>)
    expect(await screen.findByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('Higher risk')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open case' })).toHaveAttribute('href', '/clinician/cases/s9')
  })
  it('empty state', async () => {
    auth.role = 'clinician'
    api.get.mockResolvedValue({ queue: [] })
    render(<MemoryRouter><ClinicianDashboard /></MemoryRouter>)
    expect(await screen.findByText(/Nothing is waiting for review/)).toBeInTheDocument()
  })
})

describe('Admin verification', () => {
  it('shows org + licence and approves / rejects', async () => {
    auth.role = 'admin'
    const pending = [{ uid: 'p1', name: 'Dr Pending', email: 'p@x.test', role: 'clinician', verified: false, verificationStatus: 'pending', orgName: 'Demo Clinic', licenseNumber: 'LIC-123', createdAt: '2026-09-01T00:00:00Z' }]
    api.get.mockImplementation(async (path, params) => (params?.status === 'pending' ? { users: pending, total: 1 } : { users: pending, total: 1 }))
    api.patch.mockResolvedValue({ user: {} })
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    const queue = (await screen.findByRole('heading', { name: /Pending verification/ })).closest('section')
    expect(within(queue).getByText('Demo Clinic')).toBeInTheDocument()
    expect(within(queue).getByText('LIC-123')).toBeInTheDocument()
    await userEvent.setup().click(within(queue).getByRole('button', { name: 'Approve Dr Pending' }))
    expect(api.patch).toHaveBeenCalledWith('/api/admin/users/p1/verify', { verified: true })
  })
})
