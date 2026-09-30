import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../lib/api', () => ({ api, default: api }))
vi.mock('../context/ChildContext', () => ({ useChildren: () => ({ activeChild: { id: 'c1', name: 'Alex' } }) }))

import InsightPanel from './clinical/InsightPanel'
import InsightForFamily from './InsightForFamily'
import AskAutaraCard from './dashboard/AskAutaraCard'

beforeEach(() => vi.clearAllMocks())

const insight = (over = {}) => ({
  id: 'i1', screeningId: 's1', status: 'generated', generatedAt: '2026-09-02T10:00:00Z', model: 'test-llm', promptVersion: 'insight_v1',
  summary: 'Clinician summary text.', caregiverSummary: 'Plain words for the family.', uncertainty: 'This is parent-reported and not a diagnosis.',
  flaggedAreas: [{ area: 'Joint attention', explanation: 'Items were flagged.', evidence: [{ type: 'screening_response', id: '7' }, { type: 'behaviour_log', id: 'log-abc' }], references: [] }],
  failureReasons: [], readingGrade: 5, ...over,
})

describe('InsightPanel', () => {
  it('shows evidence links that jump to the exact answer / log, sources, uncertainty and the review banner', async () => {
    api.get.mockResolvedValue({ insights: [insight()] })
    render(<InsightPanel screening={{ id: 's1', status: 'UNDER_CLINICAL_REVIEW' }} canAct />)
    expect(await screen.findByText('Clinician summary text.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Answer 7' })).toHaveAttribute('href', '#answer-7')
    expect(screen.getByRole('link', { name: 'Behaviour log' })).toHaveAttribute('href', '#log-log-abc')
    expect(screen.getByText(/none — patient evidence only/)).toBeInTheDocument()
    expect(screen.getByText(/parent-reported and not a diagnosis/)).toBeInTheDocument()
    expect(screen.getByText(/Clinical review is required/)).toBeInTheDocument()
    expect(screen.getByText('Awaiting your approval')).toBeInTheDocument()
  })

  it('lists cited reference sources with page and section', async () => {
    const i = insight(); i.flaggedAreas[0].references = [{ source: 'Approved Guide', page: 3, section: 'Screening' }]
    api.get.mockResolvedValue({ insights: [i] })
    render(<InsightPanel screening={{ id: 's1', status: 'UNDER_CLINICAL_REVIEW' }} canAct />)
    expect(await screen.findByText('Approved Guide, p. 3 — Screening')).toBeInTheDocument()
  })

  it('generates, then approves for the family', async () => {
    api.get.mockResolvedValueOnce({ insights: [] }).mockResolvedValue({ insights: [insight()] })
    api.post.mockResolvedValue({})
    render(<InsightPanel screening={{ id: 's1', status: 'UNDER_CLINICAL_REVIEW' }} canAct />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Generate AI insight' }))
    expect(api.post).toHaveBeenCalledWith('/api/insights/generate', { screeningId: 's1' })
    await user.click(await screen.findByRole('button', { name: 'Approve for the family' }))
    expect(api.post).toHaveBeenCalledWith('/api/insights/i1/approve')
  })

  it('explains a blocked generation in plain words and offers no approve button', async () => {
    api.get.mockResolvedValue({ insights: [insight({ status: 'failed', failureReasons: ['BANNED_PHRASE:has_condition'] })] })
    render(<InsightPanel screening={{ id: 's1', status: 'UNDER_CLINICAL_REVIEW' }} canAct />)
    expect(await screen.findByText(/wording that suggests a diagnosis, so it was blocked/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })

  it('shows generation errors (e.g. AI service down)', async () => {
    api.get.mockResolvedValue({ insights: [] })
    api.post.mockRejectedValue(new Error('The AI service is currently unavailable. Please try again later.'))
    render(<InsightPanel screening={{ id: 's1', status: 'UNDER_CLINICAL_REVIEW' }} canAct />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Generate AI insight' }))
    expect(await screen.findByText(/AI service is currently unavailable/)).toBeInTheDocument()
  })

  it('is read-only for therapists and locked once reviewed', async () => {
    api.get.mockResolvedValue({ insights: [] })
    const { rerender } = render(<InsightPanel screening={{ id: 's1', status: 'UNDER_CLINICAL_REVIEW' }} canAct={false} />)
    expect(await screen.findByText(/No clinician-approved insight/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate/ })).not.toBeInTheDocument()
    rerender(<InsightPanel screening={{ id: 's1', status: 'REVIEWED' }} canAct />)
    expect(screen.queryByRole('button', { name: /Generate/ })).not.toBeInTheDocument()
  })
})

describe('InsightForFamily', () => {
  it('shows nothing AI-written before approval', async () => {
    api.get.mockResolvedValue({ insights: [] })
    render(<InsightForFamily screeningId="s1" />)
    expect(await screen.findByText(/only after a clinician has reviewed it/)).toBeInTheDocument()
  })
  it('shows only the plain-language summary, the AI+clinician note and the disclaimer once approved', async () => {
    api.get.mockResolvedValue({ insights: [{ id: 'i1', caregiverSummary: 'Plain words for the family.', approvedAt: '2026-09-03T00:00:00Z', aiGenerated: true }] })
    render(<InsightForFamily screeningId="s1" />)
    expect(await screen.findByText('Plain words for the family.')).toBeInTheDocument()
    expect(screen.getByText(/drafted with AI and approved by your clinician/)).toBeInTheDocument()
    expect(screen.getByText(/screening aid, not a diagnosis/)).toBeInTheDocument()
  })
})

describe('AskAutaraCard', () => {
  it('posts the question with the active child for context and lists sources', async () => {
    api.post.mockResolvedValue({ answer: 'A follow-up interview asks more questions.', sources: [{ title: 'Approved Guide', publisher: 'Demo Publisher', url: 'https://x.test', version: '2024', page: 4 }], guardrail: null })
    render(<AskAutaraCard />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your question'), 'What is a follow-up interview?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(api.post).toHaveBeenCalledWith('/api/assistant/ask', { question: 'What is a follow-up interview?', childId: 'c1' })
    expect(await screen.findByText('A follow-up interview asks more questions.')).toBeInTheDocument()
    const sources = screen.getByRole('list', { name: 'Sources' })
    expect(within(sources).getByRole('link', { name: 'Approved Guide' })).toHaveAttribute('href', 'https://x.test')
    expect(sources).toHaveTextContent('Demo Publisher, 2024, p. 4')
  })

  it('can opt out of sharing child context', async () => {
    api.post.mockResolvedValue({ answer: 'ok', sources: [], guardrail: null })
    render(<AskAutaraCard />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByLabelText('Your question'), 'General question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(api.post).toHaveBeenCalledWith('/api/assistant/ask', { question: 'General question' })
  })

  it('makes an urgent-safety answer an alert and says "Sources: none" when there are none', async () => {
    api.post.mockResolvedValue({ answer: 'Please contact your local emergency services now.', sources: [], guardrail: 'urgent_safety' })
    render(<AskAutaraCard />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your question'), 'My child is not breathing')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('emergency services')
    expect(screen.getByText('Urgent safety')).toBeInTheDocument()
    expect(screen.getByText('Sources: none')).toBeInTheDocument()
  })

  it('shows the no-reference-material message and rate-limit errors', async () => {
    api.post.mockResolvedValueOnce({ answer: 'No reference material has been loaded into Autara yet.', sources: [], guardrail: 'no_sources' })
              .mockRejectedValueOnce(new Error("You've reached the limit of 20 questions per hour."))
    render(<AskAutaraCard />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your question'), 'Q1')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/No reference material has been loaded/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Your question'), 'Q2')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/reached the limit of 20 questions/)).toBeInTheDocument()
  })
})
