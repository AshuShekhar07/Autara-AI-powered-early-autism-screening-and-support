import { useCallback } from 'react'
import { api } from '../lib/api'
import { useApi } from './useApi'

export const MILESTONE_STATUSES = ['not_reviewed', 'in_progress', 'reviewed']

/** Persisted milestone statuses: GET/PUT /api/children/:id/milestones */
export function useMilestones(childId) {
  const { data, loading, error, reload } = useApi(
    () => api.get(`/api/children/${childId}/milestones`), [childId], !!childId
  )
  const save = useCallback(async (category, status) => {
    await api.put(`/api/children/${childId}/milestones`, { statuses: { [category]: status } })
    reload()
  }, [childId, reload])
  return { statuses: data?.statuses || null, loading, error, save, reload }
}
