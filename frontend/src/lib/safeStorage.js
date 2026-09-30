/** sessionStorage / localStorage can throw (private mode, blocked site data) — never let that break the UI. */
function make(getStore) {
  return {
    get(key) {
      try { return JSON.parse(getStore().getItem(key)) } catch { return null }
    },
    set(key, value) {
      try { getStore().setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
    },
    remove(key) {
      try { getStore().removeItem(key) } catch { /* ignore */ }
    },
  }
}

export const safeSession = make(() => window.sessionStorage)
export const safeLocal   = make(() => window.localStorage)
