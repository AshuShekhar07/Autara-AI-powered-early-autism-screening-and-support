import { useEffect, useState } from 'react'
import { safeSession } from './safeStorage'

/**
 * useState that is also kept in this tab's sessionStorage, so work in progress (a half-filled form,
 * the Ask conversation) survives moving to another page and back, or a refresh. Cleared on log out
 * (AuthContext) and when the tab closes. `key` may change (e.g. another child): the state is then
 * re-read from that key. A null key behaves like plain useState.
 */
export function useSessionState(key, initial) {
  const read = (k) => {
    const saved = k ? safeSession.get(k) : null
    if (saved !== null && saved !== undefined) return saved
    return typeof initial === 'function' ? initial() : initial
  }
  const [state, setState] = useState(() => ({ key, value: read(key) }))

  let current = state
  if (state.key !== key) {            // key changed during render → load that key's value now
    current = { key, value: read(key) }
    setState(current)
  }

  useEffect(() => {
    if (current.key) safeSession.set(current.key, current.value)
  }, [current.key, current.value])

  const setValue = (next) =>
    setState((s) => ({ key: s.key, value: typeof next === 'function' ? next(s.value) : next }))

  return [current.value, setValue]
}
