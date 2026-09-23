import React, { useState, useRef, useEffect } from 'react'
import './NotificationBell.css'

// ─────────────────────────────────────────────────────────────────────────────
// Notification data structure:
//   { id, type, title, message, timestamp, read }
// Possible types: 'care_team' | 'resource' | 'profile' | 'system'
//
// TODO: Replace getNotifications() with GET /api/notifications when the
// backend notification system is implemented. The hook below is designed
// to make that swap a single-line change.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns demo notifications for UI development.
 * In production with no backend, this returns [] and the empty state renders.
 * Set USE_DEMO_DATA = false to show the production empty state.
 */
const USE_DEMO_DATA = true

function getDemoNotifications() {
  if (!USE_DEMO_DATA) return []
  const now = Date.now()
  return [
    {
      id:        'n1',
      type:      'care_team',
      title:     'Care team',
      message:   'A professional connection request is pending review.',
      timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
      read:      false,
    },
    {
      id:        'n2',
      type:      'resource',
      title:     'Resources',
      message:   'New developmental milestone resources are available.',
      timestamp: now - 26 * 60 * 60 * 1000, // yesterday
      read:      false,
    },
    {
      id:        'n3',
      type:      'profile',
      title:     'Profile',
      message:   'Your child profile has been saved successfully.',
      timestamp: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      read:      true,
    },
  ]
}

/** Format timestamp as a human-readable relative string. */
function formatTime(ts) {
  const diffMs  = Date.now() - ts
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
  const cls = `notif-icon notif-icon--${type}`
  if (type === 'care_team') return (
    <span className={cls} aria-hidden="true">
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </span>
  )
  if (type === 'resource') return (
    <span className={cls} aria-hidden="true">
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    </span>
  )
  if (type === 'profile') return (
    <span className={cls} aria-hidden="true">
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </span>
  )
  // system / fallback
  return (
    <span className={cls} aria-hidden="true">
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </span>
  )
}

export default function NotificationBell() {
  const [open,          setOpen]  = useState(false)
  const [notifications, setNotifs] = useState(getDemoNotifications)
  const ref = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function markRead(id) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className="notif-bell__btn"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications — no new notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {/* Bell icon */}
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell__badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notif-dropdown"
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
        >
          <div className="notif-dropdown__header">
            <span className="notif-dropdown__title">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-dropdown__mark-all"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="notif-empty">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <p className="notif-empty__title">You're all caught up</p>
              <p className="notif-empty__sub">No new notifications.</p>
            </div>
          ) : (
            <ul className="notif-list" role="list">
              {notifications.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                    onClick={() => markRead(n.id)}
                    aria-label={`${n.title}: ${n.message}. ${formatTime(n.timestamp)}${n.read ? '' : '. Unread.'}`}
                  >
                    <NotifIcon type={n.type} />
                    <div className="notif-item__body">
                      <span className="notif-item__title">{n.title}</span>
                      <span className="notif-item__msg">{n.message}</span>
                      <span className="notif-item__time">{formatTime(n.timestamp)}</span>
                    </div>
                    {!n.read && <span className="notif-item__dot" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="notif-dropdown__footer">
            <button
              type="button"
              className="notif-dropdown__view-all"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
