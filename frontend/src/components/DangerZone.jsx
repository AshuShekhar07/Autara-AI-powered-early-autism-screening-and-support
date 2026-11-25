import React, { useId, useState } from 'react'

/**
 * A red "permanently delete" box. The action button only works after the user types `confirmWord`
 * (case-insensitive), so nothing is deleted by a stray click.
 *
 * Props: title, children (explanation), confirmWord, buttonLabel, onConfirm(typed) → Promise, onCancel?
 */
export default function DangerZone({ title, children, confirmWord, buttonLabel, onConfirm, onCancel }) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const matches = typed.trim().toLowerCase() === String(confirmWord).trim().toLowerCase()

  async function submit(e) {
    e.preventDefault()
    if (!matches || busy) return
    setBusy(true); setError('')
    try {
      await onConfirm(typed.trim())
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form className="danger-zone" onSubmit={submit} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="danger-zone__title">{title}</h2>
      <div className="danger-zone__body">{children}</div>
      <div className="field">
        <label htmlFor={`${id}-confirm`}>Type <strong>{confirmWord}</strong> to confirm</label>
        <input id={`${id}-confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={busy} />
      </div>
      {error && <div className="status-box status-box--error" role="alert">{error}</div>}
      <div className="danger-zone__actions">
        <button type="submit" className="btn btn--danger" disabled={!matches || busy} aria-busy={busy}>
          {busy ? 'Deleting…' : buttonLabel}
        </button>
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  )
}
