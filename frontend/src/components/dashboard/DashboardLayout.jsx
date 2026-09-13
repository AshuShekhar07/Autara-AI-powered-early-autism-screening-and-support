import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './DashboardLayout.css'

/* ── Inline SVG leaf logo mark (same as AuthPage) ── */
function LogoMark({ size = 32 }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 44 44" fill="none"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="12" fill="#2F6F62" />
      <path
        d="M22 10c0 0-10 6-10 14a10 10 0 0 0 20 0C32 16 22 10 22 10z"
        fill="rgba(255,255,255,.92)"
      />
      <path
        d="M22 14v18"
        stroke="#2F6F62" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  )
}

/* ── User avatar / initials ── */
function Avatar({ name, email, size = 'md' }) {
  const initials = (() => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase()
    }
    return email ? email[0].toUpperCase() : '?'
  })()
  return (
    <div
      className={`db-avatar${size === 'sm' ? ' db-avatar--sm' : ''}`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

/* ── Nav items config ── */
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    id: 'screening',
    label: 'New Screening',
    href: '/screening',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    href: '/history',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <polyline points="12 7 12 12 15 15"/>
      </svg>
    ),
  },
  {
    id: 'ask',
    label: 'Ask Autara',
    href: '/ask',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
]

/* ── User dropdown (topnav) ── */
function UserMenu({ user, role, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'

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

  return (
    <div className="db-user-menu" ref={ref}>
      <button
        type="button"
        className="db-user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open user menu"
        onClick={() => setOpen(v => !v)}
      >
        <Avatar name={user?.displayName} email={user?.email} size="sm" />
        <span className="db-user-menu__name">{displayName}</span>
        <svg
          className="db-user-menu__chevron"
          width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
          viewBox="0 0 24 24" aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="db-user-menu__dropdown" role="menu" aria-label="User menu">
          <button
            type="button"
            className="db-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
          <div className="db-dropdown-divider" role="separator" />
          <button
            type="button"
            className="db-dropdown-item db-dropdown-item--danger"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout() }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Nav link — handles "coming soon" routes gracefully ── */
function NavItem({ item, activeId, onClick }) {
  const isActive = item.id === activeId
  // Routes not yet built redirect to /dashboard for now
  const isBuilt = item.href === '/dashboard' || item.href === '/screening'

  function handleClick(e) {
    if (!isBuilt) {
      e.preventDefault()
      // No-op for now; sidebar shows them disabled-ish via opacity
    }
    if (onClick) onClick()
  }

  return (
    <Link
      to={isBuilt ? item.href : '#'}
      className={`db-nav-item${isActive ? ' db-nav-item--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={handleClick}
      style={!isBuilt ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
      tabIndex={!isBuilt ? -1 : 0}
      aria-disabled={!isBuilt}
    >
      <span className="db-nav-item__icon">{item.icon}</span>
      {item.label}
    </Link>
  )
}

/* ── Main layout component ── */
export default function DashboardLayout({ children, activeNav = 'dashboard', pageTitle = 'Dashboard' }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'

  return (
    <div className="db-shell">
      {/* ── Desktop sidebar ── */}
      <aside className="db-sidebar" aria-label="Main navigation">
        <Link to="/dashboard" className="db-sidebar__brand" aria-label="Autara home">
          <LogoMark size={36} />
          <div className="db-sidebar__wordmark">
            <span className="db-sidebar__name">Autara</span>
            <span className="db-sidebar__tagline">Early Support</span>
          </div>
        </Link>

        <nav className="db-sidebar__nav" aria-label="Site navigation">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.id} item={item} activeId={activeNav} />
          ))}
        </nav>

        <div className="db-sidebar__footer">
          <div className="db-sidebar__user" aria-label={`Signed in as ${displayName}`}>
            <Avatar name={user?.displayName} email={user?.email} />
            <div className="db-sidebar__user-info">
              <span className="db-sidebar__user-name">{displayName}</span>
              <span className="db-sidebar__user-role">{role}</span>
            </div>
          </div>
          <button
            type="button"
            className="db-sidebar__logout"
            onClick={handleLogout}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="db-main" id="main-content">
        {/* Mobile top bar */}
        <div className="db-mobile-topbar" role="banner">
          <Link to="/dashboard" className="db-mobile-brand" aria-label="Autara home">
            <LogoMark size={28} />
            <span className="db-mobile-brand__name">Autara</span>
          </Link>
          <UserMenu user={user} role={role} onLogout={handleLogout} />
        </div>

        {/* Desktop top nav */}
        <header className="db-topnav" role="banner">
          <span className="db-topnav__page-title">{pageTitle}</span>
          <div className="db-topnav__right">
            <UserMenu user={user} role={role} onLogout={handleLogout} />
          </div>
        </header>

        {/* Page content */}
        <main className="db-content" aria-label="Page content">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="db-bottom-tabs" aria-label="Mobile navigation">
        <div className="db-bottom-tabs__inner">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const isActive = item.id === activeNav
            const isBuilt  = item.href === '/dashboard' || item.href === '/screening'
            return (
              <Link
                key={item.id}
                to={isBuilt ? item.href : '#'}
                className={`db-tab-btn${isActive ? ' db-tab-btn--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                style={!isBuilt ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
                tabIndex={!isBuilt ? -1 : 0}
              >
                <span className="db-tab-btn__icon">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
