import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, role: null, verified: false, loading: false, login: vi.fn(), signup: vi.fn(), resetPassword: vi.fn() }),
}))

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, default: {} }))

import AuthPage from './AuthPage'

const at = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/login" element={<AuthPage />} /><Route path="/signup" element={<AuthPage />} /></Routes>
  </MemoryRouter>,
)

describe('AuthPage', () => {
  it('/signup opens the sign-up form (it used to show the login form)', () => {
    at('/signup')
    expect(screen.getByRole('form', { name: 'Create an Autara account' })).toBeInTheDocument()
  })
  it('/login opens the login form and the page has a level-one heading', () => {
    at('/login')
    expect(screen.getByRole('form', { name: 'Log in to Autara' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Autara' })).toBeInTheDocument()
  })
  it('sign-up consent text has no links to pages that do not exist', () => {
    at('/signup')
    expect(screen.queryByRole('link', { name: /Terms of Service|Privacy Policy/ })).toBeNull()
  })
})
