import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const state = vi.hoisted(() => ({ activeChild: null }))
vi.mock('../context/ChildContext', () => ({ useChildren: () => ({ activeChild: state.activeChild }) }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'a@b.test' }, role: 'caregiver', verified: true, logout: vi.fn() }) }))
vi.mock('../components/dashboard/NotificationBell', () => ({ default: () => null }))

import Milestones from './Milestones'

const dobMonthsAgo = (m) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 10) }
const ui = () => <MemoryRouter><Milestones /></MemoryRouter>

describe('Milestones page', () => {
  it("selects the child's age group once the child has loaded (it used to stay on 2 months)", () => {
    state.activeChild = null                                   // first render: children still loading
    const { rerender } = render(ui())
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('2 months')
    state.activeChild = { id: 'c1', dob: dobMonthsAgo(22) }    // loaded: 22 months old → 12-month group
    rerender(ui())
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('12 months')
    state.activeChild = { id: 'c2', dob: dobMonthsAgo(40) }    // switched child → 3 years
    rerender(ui())
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('3 years')
  })
})
