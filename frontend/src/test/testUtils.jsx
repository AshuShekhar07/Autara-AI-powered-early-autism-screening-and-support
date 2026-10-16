import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

/** Mocks for the pieces every page needs: auth context + Firebase-free api wrapper. */
export const authValue = (over = {}) => ({
  user: { email: 'demo@example.test', displayName: 'Demo User' },
  role: 'caregiver', verified: true, loading: false,
  profileData: { name: 'Demo User', roleDetails: {} },
  logout: vi.fn(), hydrateProfile: vi.fn(), ...over,
})

export function renderWithRouter(ui, { route = '/' } = {}) {
  return <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
}
