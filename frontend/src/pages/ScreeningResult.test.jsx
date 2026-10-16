import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Routes, Route, MemoryRouter } from 'react-router-dom'
import { TIER_COPY } from '../lib/screeningCopy'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../lib/api', () => ({ api, default: api }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'a@b.test' }, role: 'caregiver', verified: true, logout: vi.fn() }) }))
vi.mock('../components/dashboard/NotificationBell', () => ({ default: () => null }))

import ScreeningResult from './ScreeningResult'

const instrument = {
  copyright: 'M-CHAT-R/F © 2009 Diana Robins, Deborah Fein, & Marianne Barton.',
  domainGroupingNote: 'Autara grouping, not part of the official instrument.',
  items: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, text: `Question text ${i + 1}?`, domain: 'joint_attention' })),
  domains: [{ key: 'joint_attention', label: 'Joint attention', items: [1, 2] }],
}
const base = {
  id: 's1', childId: 'c1', status: 'INSIGHTS_READY', riskScore: 4, riskTier: 'medium', effectiveRiskTier: 'medium',
  childAgeMonths: 22, createdAt: '2026-09-01T10:00:00Z', atRiskItems: [1, 7],
  answers: { 1: 'no', 7: 'no' }, domainBreakdown: [{ domain: 'joint_attention', label: 'Joint attention', atRiskCount: 2, totalItems: 7 }],
  disclaimer: 'x', clinicianReview: null,
}

function mount(screeningData, careTeam = []) {
  api.get.mockImplementation(async (path) => {
    if (path.startsWith('/api/screenings/instrument')) return { instrument }
    if (path.startsWith('/api/screenings/')) return { screening: screeningData }
    if (path.endsWith('/care-team')) return { careTeam }
    throw new Error(path)
  })
  return render(<MemoryRouter initialEntries={['/screenings/s1']}><Routes><Route path="/screenings/:id" element={<ScreeningResult />} /></Routes></MemoryRouter>)
}
beforeEach(() => vi.clearAllMocks())

describe('ScreeningResult', () => {
  it('shows tier in plain words, contributing answers, disclaimer and care-team CTA', async () => {
    mount(base)
    expect(await screen.findByRole('heading', { level: 1, name: /follow-up is recommended/ })).toBeInTheDocument()
    expect(screen.getByText(/Question 1:/)).toBeInTheDocument()
    expect(screen.getByText(/Question 7:/)).toBeInTheDocument()
    expect(screen.getAllByText(/screening aid, not a diagnosis/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Add a professional/ })).toBeInTheDocument()
  })

  it('shows the clinician override with its reason once reviewed', async () => {
    mount({ ...base, status: 'REVIEWED', effectiveRiskTier: 'low',
      clinicianReview: { override: { originalTier: 'medium', riskTier: 'low', reason: 'Observed in clinic.' } } })
    expect(await screen.findByText(/A clinician adjusted this result/)).toBeInTheDocument()
    expect(screen.getByText(/Observed in clinic\./)).toBeInTheDocument()
  })

  it('offers a retry when scoring failed', async () => {
    mount({ ...base, status: 'PROCESSING_FAILED', riskTier: null })
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })
})

describe('result copy safety', () => {
  it('never claims a diagnosis or autism level', () => {
    const text = JSON.stringify(TIER_COPY)
    expect(text).not.toMatch(/has autism|is autistic|level [123]|diagnos/i)
  })
})
