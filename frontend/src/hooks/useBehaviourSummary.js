import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

export const PERIODS = [
  { id: '2w',  label: '2 weeks',  days: 14 },
  { id: '6w',  label: '6 weeks',  days: 42 },
  { id: '12w', label: '12 weeks', days: 84 },
  { id: 'all', label: 'All time', days: null },
]

/** Loads GET /api/children/:id/behaviour-summary for a period. Returns { summary, loading, error, reload }. */
export function useBehaviourSummary(childId, periodId = '6w', refreshKey = 0) {
  const [state, setState] = useState({ summary: null, loading: true, error: '' })

  const load = useCallback(async () => {
    if (!childId) return
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const period = PERIODS.find((p) => p.id === periodId) || PERIODS[1]
      const from = period.days ? new Date(Date.now() - period.days * 86400000).toISOString() : undefined
      const { summary } = await api.get(`/api/children/${childId}/behaviour-summary`, { from })
      setState({ summary, loading: false, error: '' })
    } catch (err) {
      setState({ summary: null, loading: false, error: err.message })
    }
  }, [childId, periodId])

  useEffect(() => { load() }, [load, refreshKey])
  return { ...state, reload: load }
}
