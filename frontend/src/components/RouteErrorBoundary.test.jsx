import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom'
import RouteErrorBoundary from './RouteErrorBoundary'

function Boom() { throw new Error('kaboom') }

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('RouteErrorBoundary', () => {
  it('shows a friendly message instead of a blank page when a page crashes', () => {
    render(<MemoryRouter><RouteErrorBoundary><Boom /></RouteErrorBoundary></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent(/Something went wrong on this page/)
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
  })

  it('renders children normally, and recovers when the user navigates to a working page', async () => {
    render(
      <MemoryRouter initialEntries={['/bad']}>
        <Link to="/good">go good</Link>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/bad" element={<Boom />} />
            <Route path="/good" element={<p>GOOD PAGE</p>} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByText('go good'))
    expect(await screen.findByText('GOOD PAGE')).toBeInTheDocument()
  })
})
