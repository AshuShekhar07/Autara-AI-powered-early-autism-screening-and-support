import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const fb = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(async () => ({})),
  createUserWithEmailAndPassword: vi.fn(async () => ({})),
  signOut: vi.fn(async () => {}),
  deleteUser: vi.fn(async () => {}),
  sendEmailVerification: vi.fn(async () => {}),
}))
vi.mock('firebase/auth', () => fb)
vi.mock('../../lib/firebase', () => ({ auth: { currentUser: { uid: 'u1' } } }))
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../lib/api', () => ({ api, default: api }))
const hydrateProfile = vi.fn(async () => ({ role: 'admin' }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, role: null, loading: false, hydrateProfile }) }))

import AdminLogin from './AdminLogin'

const apiError = (code) => Object.assign(new Error(code), { code })
function setup() {
  render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes><Route path="/admin/login" element={<AdminLogin />} /><Route path="/admin" element={<div>ADMIN PANEL</div>} /></Routes>
    </MemoryRouter>,
  )
  return userEvent.setup()
}
async function fill(user, email) {
  await user.type(screen.getByLabelText('Admin email'), email)
  await user.type(screen.getByLabelText('Password', { exact: true }), 'Str0ng-pass!')
}

beforeEach(() => vi.clearAllMocks())

describe('hidden admin login', () => {
  it('someone who is not on the admin list is told "You\'re not an admin" and signed out', async () => {
    api.post.mockRejectedValue(apiError('NOT_ADMIN'))
    const user = setup()
    await fill(user, 'parent@example.test')
    await user.click(screen.getByRole('button', { name: 'Log in to admin panel' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("You're not an admin")
    expect(fb.signOut).toHaveBeenCalled()
    expect(fb.deleteUser).not.toHaveBeenCalled()      // an existing (e.g. parent) account is never deleted
    expect(screen.queryByText('ADMIN PANEL')).toBeNull()
  })

  it('a stranger who tries "create admin account" is refused and the new sign-in is deleted again', async () => {
    api.post.mockRejectedValue(apiError('NOT_ADMIN'))
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Create your admin account' }))
    await user.type(screen.getByLabelText('Full name'), 'Stranger')
    await fill(user, 'stranger@example.test')
    await user.type(screen.getByLabelText('Confirm password'), 'Str0ng-pass!')
    await user.click(screen.getByRole('button', { name: 'Create admin account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("You're not an admin")
    expect(fb.deleteUser).toHaveBeenCalled()
  })

  it('an admin whose email is not confirmed yet gets a confirmation email', async () => {
    api.post.mockRejectedValue(apiError('EMAIL_NOT_VERIFIED'))
    const user = setup()
    await fill(user, 'admin@example.test')
    await user.click(screen.getByRole('button', { name: 'Log in to admin panel' }))
    expect(await screen.findByRole('status')).toHaveTextContent('confirmation link')
    expect(fb.sendEmailVerification).toHaveBeenCalled()
  })

  it('a listed admin lands on the admin panel', async () => {
    api.post.mockResolvedValue({ role: 'admin' })
    const user = setup()
    await fill(user, 'admin@example.test')
    await user.click(screen.getByRole('button', { name: 'Log in to admin panel' }))
    await waitFor(() => expect(screen.getByText('ADMIN PANEL')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledWith('/api/auth/admin-access', {})
  })
})
