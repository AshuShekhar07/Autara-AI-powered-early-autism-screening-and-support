import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
const kids = vi.hoisted(() => ({
  refresh: vi.fn(), setActiveId: vi.fn(),
  child: { id: 'c1', name: 'River (demo)', dob: '2024-12-01T00:00:00.000Z', sex: 'other', ageMonths: 22, careTeam: [{ uid: 't' }, { uid: 'c' }] },
}))
vi.mock('../lib/api', () => ({ api, default: api }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'a@b.test' }, role: 'caregiver', verified: true, logout: vi.fn() }),
}))
vi.mock('../context/ChildContext', () => ({
  useChildren: () => ({ children: [kids.child], activeChild: kids.child, refresh: kids.refresh, setActiveId: kids.setActiveId, loading: false, error: '' }),
}))
vi.mock('../components/dashboard/NotificationBell', () => ({ default: () => null }))

import ChildProfile from './ChildProfile'

const renderPage = () => render(<MemoryRouter><ChildProfile /></MemoryRouter>)
beforeEach(() => { vi.clearAllMocks() })

describe('Child profile page', () => {
  it('shows the child, then the Edit form pre-filled (this used to crash the page)', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'River (demo)' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.getByLabelText('Name')).toHaveValue('River (demo)')
    expect(screen.getByLabelText('Date of birth')).toHaveValue('2024-12-01')
    const sex = screen.getByLabelText('Sex (optional)')
    expect(sex).toHaveValue('other')
    expect([...sex.options].map((o) => o.value)).toEqual(['', 'female', 'male', 'other'])
  })

  it('saves edits with PATCH and returns to the profile', async () => {
    api.patch.mockResolvedValue({})
    kids.refresh.mockResolvedValue()
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'River Demo')
    await user.selectOptions(screen.getByLabelText('Sex (optional)'), 'female')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/children/c1', { name: 'River Demo', dob: '2024-12-01', sex: 'female' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument())
  })

  it('opens the "Add another child" form and validates it', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Add another child' }))
    expect(screen.getByRole('heading', { name: 'Add another child' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter the child's name/i)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('adds a child with POST, makes it the active child', async () => {
    api.post.mockResolvedValue({ child: { id: 'c2' } })
    kids.refresh.mockResolvedValue()
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Add another child' }))
    await user.type(screen.getByLabelText('Name'), 'Sky Demo')
    await user.type(screen.getByLabelText('Date of birth'), '2025-02-10')
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/children', { name: 'Sky Demo', dob: '2025-02-10', sex: null }))
    await waitFor(() => expect(kids.setActiveId).toHaveBeenCalledWith('c2'))
  })
})
