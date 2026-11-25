import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api, default: api }))
const auth = vi.hoisted(() => ({ user: { uid: 'th1', email: 'th1@x.test' }, role: 'therapist', profileData: { name: 'T', email: 'th1@x.test', emailVerified: true } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

import DangerZone from './DangerZone'
import SessionNotes from './clinical/SessionNotes'
import RoleSelector from './auth/RoleSelector'

beforeEach(() => vi.clearAllMocks())

describe('DangerZone', () => {
  it('only deletes after the confirm word is typed', async () => {
    const onConfirm = vi.fn(async () => {})
    render(<DangerZone title="Delete Alex?" confirmWord="Alex" buttonLabel="Delete child permanently" onConfirm={onConfirm} />)
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Delete child permanently' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/to confirm/), 'Ale')
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText(/to confirm/), 'x')
    await user.click(button)
    expect(onConfirm).toHaveBeenCalledWith('Alex')
  })

  it('shows the server error and lets the user try again', async () => {
    const onConfirm = vi.fn(async () => { throw new Error('Type the child\'s name exactly to confirm.') })
    render(<DangerZone title="t" confirmWord="DELETE" buttonLabel="Go" onConfirm={onConfirm} />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/to confirm/), 'delete')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('exactly')
    expect(screen.getByRole('button', { name: 'Go' })).toBeEnabled()
  })
})

describe('Session notes: edit and delete', () => {
  const notes = [
    { id: 'n1', text: 'My note', authorUid: 'th1', authorName: 'Me', createdAt: '2026-11-01T10:00:00Z' },
    { id: 'n2', text: 'Colleague note', authorUid: 'th2', authorName: 'Other', createdAt: '2026-11-02T10:00:00Z' },
  ]
  it('offers Edit/Delete only on the therapist\'s own notes, saves an edit and deletes after confirming', async () => {
    api.get.mockResolvedValue({ notes, nextBefore: null })
    api.patch.mockResolvedValue({ note: { ...notes[0], text: 'Changed', editedAt: '2026-11-03T10:00:00Z' } })
    api.delete.mockResolvedValue({ deleted: true })
    render(<SessionNotes childId="c1" canWrite />)
    const user = userEvent.setup()
    expect(await screen.findByText('My note')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)        // not on the colleague's note

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const box = screen.getByLabelText('Edit note')
    await user.clear(box); await user.type(box, 'Changed')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(api.patch).toHaveBeenCalledWith('/api/children/c1/session-notes/n1', { text: 'Changed' })
    expect(await screen.findByText('Changed')).toBeInTheDocument()
    expect(screen.getByText(/edited/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(api.delete).toHaveBeenCalledWith('/api/children/c1/session-notes/n1')
    await waitFor(() => expect(screen.queryByText('Changed')).toBeNull())
    expect(screen.getByText('Colleague note')).toBeInTheDocument()
  })

  it('a clinician (read-only) gets no Edit/Delete buttons', async () => {
    api.get.mockResolvedValue({ notes, nextBefore: null })
    render(<SessionNotes childId="c1" canWrite={false} />)
    expect(await screen.findByText('My note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })
})

describe('Sign-up roles', () => {
  it('offers Caregiver, Therapist and Clinician — not Patient or Admin', () => {
    render(<RoleSelector value="caregiver" onChange={() => {}} />)
    expect(screen.getAllByRole('radio').map((r) => r.textContent.trim())).toEqual(['Caregiver', 'Therapist', 'Clinician'])
  })
})
