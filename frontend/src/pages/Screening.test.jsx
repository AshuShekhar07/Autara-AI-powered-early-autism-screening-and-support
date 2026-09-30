import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../lib/api', () => ({ api, default: api }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'a@b.test' }, role: 'caregiver', verified: true, logout: vi.fn() }),
}))
vi.mock('../components/dashboard/NotificationBell', () => ({ default: () => null }))

import Screening from './Screening'

const instrument = {
  wordingVerified: false,
  copyright: 'M-CHAT-R/F © 2009 Diana Robins, Deborah Fein, & Marianne Barton.',
  ageRangeMonths: { min: 16, max: 30 },
  items: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, text: `Question text ${i + 1}?`, domain: 'joint_attention' })),
  domains: [],
}

function setup(children) {
  api.get.mockImplementation(async (path) => {
    if (path === '/api/children') return { children }
    if (path === '/api/screenings/instrument') return { instrument }
    throw new Error('unexpected ' + path)
  })
  return render(
    <MemoryRouter initialEntries={['/screening']}>
      <Routes>
        <Route path="/screening" element={<Screening />} />
        <Route path="/screenings/:id" element={<div>RESULT PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear() })

describe('Screening wizard', () => {
  it('walks 20 questions, reviews, submits and lands on the result page', async () => {
    api.post.mockResolvedValue({ screening: { id: 'abc123' } })
    setup([{ id: 'c1', name: 'Alex', ageMonths: 22 }])
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /Alex/ }))
    for (let i = 1; i <= 20; i++) {
      expect(await screen.findByText(`Question text ${i}?`)).toBeInTheDocument()
      const next = screen.getByRole('button', { name: i === 20 ? /Review answers/ : /^Next$/ })
      expect(next).toBeDisabled()                       // must answer first
      await user.click(screen.getByLabelText('Yes'))
      await user.click(next)
    }
    expect(screen.getByRole('heading', { name: /Review your answers/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Submit screening/ }))

    await waitFor(() => expect(screen.getByText('RESULT PAGE')).toBeInTheDocument())
    const [path, body] = api.post.mock.calls[0]
    expect(path).toBe('/api/screenings')
    expect(body.childId).toBe('c1')
    expect(Object.keys(body.answers)).toHaveLength(20)
    expect(sessionStorage.getItem('autara.screeningDraft.c1')).toBeNull() // draft cleared
  })

  it('Back returns to the previous question and keeps the answer', async () => {
    setup([{ id: 'c1', name: 'Alex', ageMonths: 22 }])
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Alex/ }))
    await user.click(screen.getByLabelText('No'))
    await user.click(screen.getByRole('button', { name: /^Next$/ }))
    await user.click(screen.getByRole('button', { name: /^Back$/ }))
    expect(screen.getByText('Question text 1?')).toBeInTheDocument()
    expect(screen.getByLabelText('No')).toBeChecked()
  })

  it('restores a saved draft from sessionStorage', async () => {
    sessionStorage.setItem('autara.screeningDraft.c1', JSON.stringify({ answers: { 1: 'yes', 2: 'no' }, index: 2 }))
    setup([{ id: 'c1', name: 'Alex', ageMonths: 22 }])
    await userEvent.setup().click(await screen.findByRole('button', { name: /Alex/ }))
    expect(screen.getByText('Question text 3?')).toBeInTheDocument()
  })

  it('explains kindly and offers next steps when the child is outside 16–30 months', async () => {
    setup([{ id: 'c2', name: 'Sam', ageMonths: 40 }])
    await userEvent.setup().click(await screen.findByRole('button', { name: /Sam/ }))
    expect(screen.getByRole('heading', { name: /isn't the right fit/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /behaviour log/ })).toBeInTheDocument()
    expect(screen.getByText(/talk to your child's doctor or a qualified clinician/)).toBeInTheDocument()
    expect(screen.queryByText('Question text 1?')).not.toBeInTheDocument()
  })

  it('shows the API error and stays on review when submission fails', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('The server is busy.'), { code: 'X' }))
    sessionStorage.setItem('autara.screeningDraft.c1', JSON.stringify({
      answers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'yes'])), index: 19 }))
    setup([{ id: 'c1', name: 'Alex', ageMonths: 22 }])
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Alex/ }))
    await user.click(screen.getByRole('button', { name: /Review answers/ }))
    await user.click(screen.getByRole('button', { name: /Submit screening/ }))
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit screening/ })).toBeEnabled()
  })

  it('warns that item wording is unverified and shows the copyright', async () => {
    setup([{ id: 'c1', name: 'Alex', ageMonths: 22 }])
    expect(await screen.findByText(/not yet been checked/)).toBeInTheDocument()
    expect(screen.getByText(/Diana Robins/)).toBeInTheDocument()
    expect(screen.getByText(/screening aid, not a diagnosis/)).toBeInTheDocument()
  })
})
