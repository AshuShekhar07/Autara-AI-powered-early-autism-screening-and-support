import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { safeLocal } from '../../lib/safeStorage'
import './NotificationBell.css'

/**
 * NotificationBell
 *
 * Notifications come from GET /api/me/notifications — they are DERIVED from real data
 * (recent reviews, cases waiting, verification queue), never invented. "Read" state is a
 * per-browser convenience kept in localStorage (try/catch-wrapped), so it may reset.
 */
const READ_KEY = 'autara.notifRead'

function formatTime(iso) {
  const diffMs  = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMs / 3600000)
  const diffD   = Math.floor(diffMs / 86400000)
  if (diffMin < 60)  return diffMin <= 1 ? 'Just now' : `${diffMin} minutes ago`
  if (diffH   < 24)  return diffH === 1  ? '1 hour ago' : `${diffH} hours ago`
  if (diffD   === 1) return 'Yesterday'
  return `${diffD} days ago`
}

/** Small SVG icon per notification type. */
function NotifIcon({ type }) {
  const cls = `notif-icon notif-icon--${type === 'review' || type === 'insight' ? 'care_team' : 'system'}`
  return (
    <span className={cls} aria-hidden="true">
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        {type === 'review' || type === 'insight'
          ? <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>
          : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
      </svg>
    </span>
  )
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen]     = useState(false)
  const [items, setItems]   = useState([])
  const [readMap, setReadMap] = useState(() => safeLocal.get(READ_KEY) || {})
  const [error, setError]   = useState('')
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const { notifications } = await api.get('/api/me/notifications')
      setItems(notifications)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (open) load() }, [open, load])

  const isRead = (n) => !!readMap[`${n.id}@${n.at}`]
  const unreadCount = items.filter((n) => !isRead(n)).length

  function markRead(n) {
    const next = { ...readMap, [`${n.id}@${n.at}`]: true }
    setReadMap(next)
    safeLocal.set(READ_KEY, next)
  }
  function markAllRead() {
    const next = { ...readMap }
    items.forEach((n) => { next[`${n.id}@${n.at}`] = true })
    setReadMap(next)
    safeLocal.set(READ_KEY, next)
  }
  function open_(n) {
    markRead(n)
    setOpen(false)
    if (n.to) navigate(n.to)
  }

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className="notif-bell__btn"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications — no new notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && <span className="notif-bell__badge" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Notifications" aria-modal="false">
          <div className="notif-dropdown__header">
            <span className="notif-dropdown__title">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-dropdown__mark-all" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {error ? (
            <div className="notif-empty" role="alert">
              <p className="notif-empty__title">Couldn't load notifications</p>
              <button type="button" className="notif-dropdown__mark-all" onClick={load}>Try again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="notif-empty">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <p className="notif-empty__title">You're all caught up</p>
              <p className="notif-empty__sub">No new notifications.</p>
            </div>
          ) : (
            <ul className="notif-list" role="list">
              {items.map((n) => (
                <li key={`${n.id}@${n.at}`}>
                  <button
                    type="button"
                    className={`notif-item${isRead(n) ? '' : ' notif-item--unread'}`}
                    onClick={() => open_(n)}
                    aria-label={`${n.title}: ${n.message}. ${formatTime(n.at)}${isRead(n) ? '' : '. Unread.'}`}
                  >
                    <NotifIcon type={n.type} />
                    <div className="notif-item__body">
                      <span className="notif-item__title">{n.title}</span>
                      <span className="notif-item__msg">{n.message}</span>
                      <span className="notif-item__time">{formatTime(n.at)}</span>
                    </div>
                    {!isRead(n) && <span className="notif-item__dot" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
