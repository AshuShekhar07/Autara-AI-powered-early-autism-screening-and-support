import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'
import { isCareRole } from '../lib/roles'
import { safeLocal } from '../lib/safeStorage'

const ChildContext = createContext(null)
const ACTIVE_KEY = 'autara.activeChildId'

/**
 * Children of the signed-in caregiver / patient and which one is "active" (the child switcher).
 * Therapists and clinicians don't use this — they work from their caseload.
 */
export function ChildProvider({ children: kids }) {
  const { user, role } = useAuth()
  const [list, setList] = useState([])
  const [activeId, setActiveIdState] = useState(() => safeLocal.get(ACTIVE_KEY))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user || !isCareRole(role)) { setList([]); return }
    setLoading(true); setError('')
    try {
      const { children } = await api.get('/api/children')
      setList(children)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [user, role])

  useEffect(() => { refresh() }, [refresh])

  const setActiveId = useCallback((id) => { setActiveIdState(id); safeLocal.set(ACTIVE_KEY, id) }, [])

  const activeChild = useMemo(
    () => list.find((c) => c.id === activeId) || list[0] || null,
    [list, activeId]
  )

  const value = { children: list, activeChild, setActiveId, refresh, loading, error }
  return <ChildContext.Provider value={value}>{kids}</ChildContext.Provider>
}

export function useChildren() {
  const ctx = useContext(ChildContext)
  if (!ctx) throw new Error('useChildren must be used inside <ChildProvider>')
  return ctx
}
