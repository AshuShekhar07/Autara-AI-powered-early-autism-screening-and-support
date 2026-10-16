import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), download: vi.fn() }))
vi.mock('../lib/api', () => ({ api, default: api }))
vi.mock('../context/ChildContext', () => ({ useChildren: () => ({ activeChild: { id: 'c1', name: 'Alex' } }) }))

import ReportsSection from './dashboard/ReportsSection'
import ExportButtons from './ExportButtons'
import AnalyticsSection from './admin/AnalyticsSection'

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
})

const scr = (id, status) => ({ id, status, createdAt: '2026-09-01T00:00:00Z', effectiveRiskTier: 'medium' })
function mockLists(screenings, reports = []) {
  api.get.mockImplementation(async (path) => (path === '/api/screenings' ? { screenings } : { reports }))
}

describe('ReportsSection', () => {
  it('only offers export for REVIEWED screenings and downloads through the API', async () => {
    mockLists([scr('s1', 'REVIEWED'), scr('s2', 'INSIGHTS_READY')], [{ id: 'r1', format: 'pdf', createdAt: '2026-09-02T00:00:00Z', generatedBy: 'you' }])
    api.download.mockResolvedValue({ blob: new Blob(['x']), filename: 'autara-report-AD-2026-09-30.pdf' })
    render(<MemoryRouter><ReportsSection /></MemoryRouter>)
    const user = userEvent.setup()
    expect(await screen.findAllByRole('button', { name: 'Download PDF' })).toHaveLength(1)
    expect(screen.getByText(/PDF · .* · by you/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(api.download).toHaveBeenCalledWith('/api/reports/export', { screeningId: 's1', format: 'pdf' })
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(screen.getByText(/screening aid, not a diagnosis/)).toBeInTheDocument()
  })

  it('explains that a report needs a clinician review', async () => {
    mockLists([scr('s2', 'UNDER_CLINICAL_REVIEW')])
    render(<MemoryRouter><ReportsSection /></MemoryRouter>)
    expect(await screen.findByText(/waiting for a clinician to review/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument()
  })

  it('empty and error states', async () => {
    mockLists([])
    const { unmount } = render(<MemoryRouter><ReportsSection /></MemoryRouter>)
    expect(await screen.findByText('No reports yet')).toBeInTheDocument()
    unmount()
    api.get.mockRejectedValue(new Error('offline'))
    render(<MemoryRouter><ReportsSection /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })
})

describe('ExportButtons', () => {
  it('shows the server error (e.g. not reviewed yet)', async () => {
    api.download.mockRejectedValue(new Error('A report is available once a clinician has reviewed the screening.'))
    render(<ExportButtons screeningId="s1" />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download CSV' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('once a clinician has reviewed')
  })
})

describe('AnalyticsSection', () => {
  const analytics = {
    k: 5, totals: { users: { caregiver: 12, patient: null, therapist: null, clinician: 6 }, children: 9, screenings: 20, behaviourLogs: 150, approvedInsights: null },
    riskTierDistribution: { low: 12, medium: null, high: null },
    screeningsPerWeek: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-0${(i % 9) + 1}-01`, count: i === 11 ? 20 : null })),
    logsPerWeek: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-0${(i % 9) + 1}-01`, count: 7 })),
    medianHoursToReview: null, verificationQueueSize: 2,
  }
  it('shows "<5" for hidden numbers, exact queue size, and no identifiers', async () => {
    api.get.mockResolvedValue({ analytics })
    render(<AnalyticsSection />)
    const totals = await screen.findByLabelText('Totals')
    expect(within(totals).getAllByText('<5').length).toBeGreaterThanOrEqual(3)   // patients, therapists, median
    expect(within(totals).getByText('12')).toBeInTheDocument()
    expect(within(totals).getByText('Awaiting verification').previousSibling).toHaveTextContent('2')
    expect(screen.getByText(/never shown here/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@|uid|childId/)
  })
  it('table view marks hidden buckets and offers retry on error', async () => {
    api.get.mockResolvedValueOnce({ analytics })
    const { unmount } = render(<AnalyticsSection />)
    const tierCard = (await screen.findByRole('article', { name: 'Screenings by risk tier' }))
    await userEvent.setup().click(within(tierCard).getByRole('button', { name: /View as table/ }))
    const rows = within(tierCard).getAllByRole('row')
    expect(rows.map((r) => r.textContent)).toEqual(['TierScreenings', 'Lower risk12', 'Medium risk<5', 'Higher risk<5'])
    unmount()
    api.get.mockRejectedValue(new Error('nope'))
    render(<AnalyticsSection />)
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('nope')
  })
})
