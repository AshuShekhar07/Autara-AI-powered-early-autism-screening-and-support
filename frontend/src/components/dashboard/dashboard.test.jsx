import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() }))
const state = vi.hoisted(() => ({ role: 'caregiver', verified: true }))
vi.mock('../../lib/api', () => ({ api, default: api }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'a@b.test' }, role: state.role, verified: state.verified, profileData: { name: 'Sam Demo' }, loading: false, logout: vi.fn(), hydrateProfile: vi.fn() }),
}))
vi.mock('../../context/ChildContext', () => ({
  useChildren: () => ({ activeChild: { id: 'c1', name: 'Alex', dob: '2025-01-01', ageMonths: 20, careTeam: [] }, children: [], refresh: vi.fn(), setActiveId: vi.fn(), loading: false }),
}))
vi.mock('./NotificationBell', () => ({ default: () => null }))

import DashboardLayout from './DashboardLayout'
import CareTeamSection from './CareTeamSection'
import StatCards from './StatCards'
import ProtectedRoute from '../auth/ProtectedRoute'

beforeEach(() => { vi.clearAllMocks(); state.role = 'caregiver'; state.verified = true })

describe('role-specific navigation', () => {
  it.each([
    ['caregiver', ['Dashboard', 'New Screening', 'Behaviour log', 'History']],
    ['therapist', ['Caseload']],
    ['clinician', ['Review queue', 'Caseload']],
    ['admin', ['Admin console']],
  ])('%s sees only its own links', (role, labels) => {
    state.role = role
    render(<MemoryRouter><DashboardLayout>x</DashboardLayout></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: 'Site navigation' })
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(labels)
  })
  it('uses the real profile name, not a placeholder', () => {
    render(<MemoryRouter><DashboardLayout>x</DashboardLayout></MemoryRouter>)
    expect(screen.getAllByText('Sam Demo').length).toBeGreaterThan(0)
  })
})

describe('ProtectedRoute', () => {
  it('sends an unverified clinician to /pending-verification', () => {
    state.role = 'clinician'; state.verified = false
    render(<MemoryRouter initialEntries={['/clinician']}><Routes>
      <Route path="/clinician" element={<ProtectedRoute allowedRoles={['clinician']}>SECRET</ProtectedRoute>} />
      <Route path="/pending-verification" element={<div>PENDING PAGE</div>} />
    </Routes></MemoryRouter>)
    expect(screen.getByText('PENDING PAGE')).toBeInTheDocument()
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument()
  })
  it('sends a wrong-role user to /not-authorized', () => {
    render(<MemoryRouter initialEntries={['/admin']}><Routes>
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}>SECRET</ProtectedRoute>} />
      <Route path="/not-authorized" element={<div>NOPE</div>} />
    </Routes></MemoryRouter>)
    expect(screen.getByText('NOPE')).toBeInTheDocument()
  })
})

describe('CareTeamSection', () => {
  it('lists real members, adds by email and shows the API error for unknown professionals', async () => {
    api.get.mockResolvedValue({ careTeam: [{ uid: 't1', name: 'Tia Therapist', role: 'therapist', orgName: 'Demo Clinic' }] })
    render(<CareTeamSection />)
    const user = userEvent.setup()
    expect(await screen.findByText('Tia Therapist')).toBeInTheDocument()
    expect(screen.getByText(/Therapist · Demo Clinic/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Add a professional/i }))
    api.post.mockRejectedValueOnce(new Error('No verified professional found with that email address.'))
    await user.type(screen.getByLabelText(/Professional's email/), 'nobody@x.test')
    await user.click(screen.getByRole('button', { name: 'Add to care team' }))
    expect(await screen.findByText(/No verified professional found/)).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/api/children/c1/care-team', { email: 'nobody@x.test' })
  })

  it('removal needs a confirmation click', async () => {
    api.get.mockResolvedValue({ careTeam: [{ uid: 't1', name: 'Tia Therapist', role: 'therapist' }] })
    api.delete.mockResolvedValue({ careTeam: [] })
    render(<CareTeamSection />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Remove Tia Therapist from the care team' }))
    expect(api.delete).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(api.delete).toHaveBeenCalledWith('/api/children/c1/care-team/t1')
  })

  it('empty state when nobody is connected', async () => {
    api.get.mockResolvedValue({ careTeam: [] })
    render(<CareTeamSection />)
    expect(await screen.findByText('No professionals connected yet')).toBeInTheDocument()
  })
})

describe('StatCards', () => {
  it('shows real values, and honest empty text before any data', () => {
    const { rerender } = render(<MemoryRouter><StatCards overview={{ lastScreening: null, screeningCount: 0, logsThisWeek: 0, openActions: [] }} /></MemoryRouter>)
    expect(screen.getAllByText('No data yet').length).toBeGreaterThan(0)
    rerender(<MemoryRouter><StatCards overview={{ lastScreening: { id: 's1', effectiveRiskTier: 'medium', createdAt: '2026-09-01T00:00:00Z' }, screeningCount: 2, logsThisWeek: 5, openActions: [{ id: 'x' }] }} /></MemoryRouter>)
    expect(screen.getByText('Medium risk')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
  it('shows an error box', () => {
    render(<MemoryRouter><StatCards overview={null} error="boom" /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })
})
