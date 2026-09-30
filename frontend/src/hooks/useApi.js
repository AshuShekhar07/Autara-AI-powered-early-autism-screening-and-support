import { useCallback, useEffect, useState } from 'react'

/**
 * Tiny data-loading hook: runs `fn()` (an api call) when `deps` change and exposes
 * { data, loading, error, reload }. Pass `enabled=false` to skip (e.g. no child selected yet).
 * Stale responses from an older call are ignored.
 */
export function useApi(fn, deps, enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) { setState({ data: null, loading: false, error: '' }); return undefined }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: '' }))
    fn()
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: '' }) })
      .catch((err) => { if (!cancelled) setState({ data: null, loading: false, error: err.message || 'Something went wrong.' }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
