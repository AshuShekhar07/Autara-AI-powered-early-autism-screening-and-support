import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('../../lib/api', () => ({ api, default: api }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'me' } }) }))

import LogBehaviourForm from './LogBehaviourForm'
import BehaviourHistory from './BehaviourHistory'
import BehaviourCharts, { TriggerMatrix, WeeklyTrendChart } from './BehaviourCharts'

beforeEach(() => vi.clearAllMocks())

const summary = {
  totalLogs: 7, averageIntensity: 3.57,
  byBehaviour: [{ category: 'meltdown_tantrum', count: 5, averageIntensity: 3 }],
  matrix: [{ antecedent: 'transition', behaviour: 'meltdown_tantrum', count: 4 }, { antecedent: 'demand_or_task', behaviour: 'withdrawal', count: 1 }],
  consequencesByBehaviour: [{ behaviour: 'meltdown_tantrum', consequence: 'comforted', count: 3 }],
  weeklyTrend: [{ weekStart: '2026-08-31', count: 5, averageIntensity: 3 }, { weekStart: '2026-09-07', count: 0, averageIntensity: null }],
  byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 9 ? 4 : 0 })),
  byWeekday: Array.from({ length: 7 }, (_, weekday) => ({ weekday, count: 1 })),
  topPairs: [{ antecedent: 'transition', behaviour: 'meltdown_tantrum', count: 4, share: 0.57 }],
}

describe('LogBehaviourForm', () => {
  it('needs the three chips, then posts category picks + local timezone offset', async () => {
    api.post.mockResolvedValue({ log: { id: 'l1' } })
    const onLogged = vi.fn()
    render(<LogBehaviourForm childId="c1" onLogged={onLogged} />)
    const user = userEvent.setup()
    const save = screen.getByRole('button', { name: /Save entry/ })
    expect(save).toBeDisabled()

    await user.click(screen.getByLabelText('Change of activity'))
    await user.click(screen.getByLabelText('Meltdown / tantrum'))
    expect(save).toBeDisabled()
    await user.click(screen.getByLabelText('Comforted'))
    await user.click(screen.getByLabelText('4'))
    await user.click(save)

    await waitFor(() => expect(onLogged).toHaveBeenCalled())
    const [path, body] = api.post.mock.calls[0]
    expect(path).toBe('/api/children/c1/behaviour-logs')
    expect(body).toMatchObject({
      antecedent: { category: 'transition' }, behaviour: { category: 'meltdown_tantrum' },
      consequence: { category: 'comforted' }, intensity: 4, setting: 'home',
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
    })
    expect(body.occurredAt).toBeUndefined() // defaults to "now" on the server
    expect(await screen.findByText(/Saved/)).toBeInTheDocument()
    expect(save).toBeDisabled() // reset for the next entry
  })

  it('shows API errors', async () => {
    api.post.mockRejectedValue(new Error('Something broke'))
    render(<LogBehaviourForm childId="c1" />)
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Change of activity'))
    await user.click(screen.getByLabelText('Meltdown / tantrum'))
    await user.click(screen.getByLabelText('Comforted'))
    await user.click(screen.getByRole('button', { name: /Save entry/ }))
    expect(await screen.findByText('Something broke')).toBeInTheDocument()
  })
})

describe('BehaviourHistory', () => {
  const log = (id, by) => ({ id, loggedBy: by, loggedByRole: 'caregiver', occurredAt: '2026-09-01T10:00:00Z', antecedent: { category: 'transition' }, behaviour: { category: 'meltdown_tantrum', description: 'Cried' }, consequence: { category: 'comforted' }, intensity: 3, setting: 'home', durationMinutes: 5 })

  it('shows empty state', async () => {
    api.get.mockResolvedValue({ logs: [], nextBefore: null })
    render(<BehaviourHistory childId="c1" />)
    expect(await screen.findByText(/No entries yet/)).toBeInTheDocument()
  })

  it('lists entries; only own entries can be deleted (with confirm)', async () => {
    api.get.mockResolvedValue({ logs: [log('a', 'me'), log('b', 'someone-else')], nextBefore: null })
    api.delete.mockResolvedValue({ deleted: true })
    render(<BehaviourHistory childId="c1" />)
    const user = userEvent.setup()
    expect(await screen.findAllByText('Meltdown / tantrum')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Delete entry/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /^Delete entry/ }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(screen.getAllByText('Meltdown / tantrum')).toHaveLength(1))
    expect(api.delete).toHaveBeenCalledWith('/api/children/c1/behaviour-logs/a')
  })

  it('shows an error with retry', async () => {
    api.get.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce({ logs: [], nextBefore: null })
    render(<BehaviourHistory childId="c1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/No entries yet/)).toBeInTheDocument()
  })
})

describe('charts states', () => {
  it('loading, error (with retry) and empty states', async () => {
    const { rerender } = render(<WeeklyTrendChart summary={null} loading error="" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    const retry = vi.fn()
    rerender(<WeeklyTrendChart summary={null} loading={false} error="Server down" onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Server down')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalled()
    rerender(<WeeklyTrendChart summary={{ totalLogs: 0, weeklyTrend: [] }} loading={false} error="" />)
    expect(screen.getByText(/Nothing logged in this period yet/)).toBeInTheDocument()
  })

  it('every chart can be viewed as a table', async () => {
    render(<WeeklyTrendChart summary={summary} loading={false} error="" />)
    await userEvent.setup().click(screen.getByRole('button', { name: /View as table/ }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '31 Aug' })).toBeInTheDocument()
  })

  it('trigger matrix prints counts in cells and lists top patterns; hides empty rows', () => {
    render(<TriggerMatrix summary={summary} loading={false} error="" />)
    expect(screen.getByLabelText('Change of activity then Meltdown / tantrum: 4')).toHaveTextContent('4')
    expect(screen.getByText(/Most common patterns/)).toBeInTheDocument()
    expect(screen.queryByText('Change in routine')).not.toBeInTheDocument()
  })

  it('BehaviourCharts loads the summary for the chosen period and can switch it', async () => {
    api.get.mockResolvedValue({ summary })
    render(<BehaviourCharts childId="c1" />)
    const user = userEvent.setup()
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get.mock.calls[0][0]).toBe('/api/children/c1/behaviour-summary')
    expect(api.get.mock.calls[0][1].from).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'All time' }))
    await waitFor(() => expect(api.get.mock.calls.at(-1)[1].from).toBeUndefined())
    expect(await screen.findByText(/7 entries · average intensity 3.57/)).toBeInTheDocument()
  })
})
