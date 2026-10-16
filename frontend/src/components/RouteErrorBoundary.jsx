import React from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Catches a crash inside any page so the user never sees a blank white screen.
 * Shows a short message with "Reload page" and "Go to start". The boundary resets when the user navigates elsewhere.
 * (The technical error stays in the browser console, F12, for debugging.)
 */
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[Autara] page crashed:', error, info?.componentStack) }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="stub-page" role="alert">
        <h1>Something went wrong on this page</h1>
        <p>Please reload the page. If it keeps happening, go back to the start page and try again.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Reload page</button>
          <button type="button" className="btn btn--ghost" onClick={() => { window.location.assign('/') }}>Go to start</button>
        </div>
        <details style={{ marginTop: 16, maxWidth: 560 }}>
          <summary>Technical details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8rem' }}>{String(this.state.error?.message || this.state.error)}</pre>
        </details>
      </div>
    )
  }
}

export default function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}
