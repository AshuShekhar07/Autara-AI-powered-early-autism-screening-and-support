import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from './NotificationBell'
import { homeRouteFor } from '../../lib/roles'
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

/* ── Nav icons ── */
const svg = (children) => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
)
const ICONS = {
  dashboard: svg(<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>),
  screening: svg(<><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>),
  behaviour: svg(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
  history:   svg(<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></>),
  ask:       svg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>),
  reports:   svg(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></>),
  caseload:  svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  queue:     svg(<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>),
  admin:     svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>),
}

/** Each role gets its own navigation. Only routes that exist are listed. */
const NAV_BY_ROLE = {
  caregiver: [
    { id: 'dashboard', label: 'Dashboard',     href: '/dashboard', icon: ICONS.dashboard },
    { id: 'screening', label: 'New Screening', href: '/screening', icon: ICONS.screening },
    { id: 'behaviour', label: 'Behaviour log', href: '/behaviour', icon: ICONS.behaviour },
    { id: 'history',   label: 'History',       href: '/history',   icon: ICONS.history },
  ],
  therapist: [
    { id: 'caseload', label: 'Caseload', href: '/therapist', icon: ICONS.caseload },
  ],
  clinician: [
    { id: 'queue',    label: 'Review queue', href: '/clinician',          icon: ICONS.queue },
    { id: 'caseload', label: 'Caseload',     href: '/clinician/caseload', icon: ICONS.caseload },
  ],
  admin: [
    { id: 'admin', label: 'Admin console', href: '/admin', icon: ICONS.admin },
  ],
}
NAV_BY_ROLE.patient = NAV_BY_ROLE.caregiver

const TAGLINES = { caregiver: 'Early Support', patient: 'Early Support', therapist: 'Care team', clinician: 'Clinical review', admin: 'Administration' }

/* ── User dropdown (topnav) ── */
function UserMenu({ user, name, role, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const displayName = name || user?.email?.split('@')[0] || 'User'

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
        <Avatar name={name} email={user?.email} size="sm" />
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

/* ── Nav link ── */
function NavItem({ item, activeId }) {
  const isActive = item.id === activeId
  return (
    <Link
      to={item.href}
      className={`db-nav-item${isActive ? ' db-nav-item--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="db-nav-item__icon">{item.icon}</span>
      {item.label}
    </Link>
  )
}

/* ── Main layout component ── */
export default function DashboardLayout({ children, activeNav = 'dashboard', pageTitle = 'Dashboard' }) {
  const { user, role, verified, profileData, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = NAV_BY_ROLE[role] || []
  const home = homeRouteFor(role, verified)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const fullName = profileData?.name || user?.displayName || null
  const displayName = fullName || user?.email?.split('@')[0] || 'User'

  return (
    <div className="db-shell">
      {/* ── Desktop sidebar ── */}
      <aside className="db-sidebar" aria-label="Main navigation">
        <Link to={home} className="db-sidebar__brand" aria-label="Autara home">
          <LogoMark size={36} />
          <div className="db-sidebar__wordmark">
            <span className="db-sidebar__name">Autara</span>
            <span className="db-sidebar__tagline">{TAGLINES[role] || 'Autara'}</span>
          </div>
        </Link>

        <nav className="db-sidebar__nav" aria-label="Site navigation">
          {navItems.map(item => (
            <NavItem key={item.id} item={item} activeId={activeNav} />
          ))}
        </nav>

        <div className="db-sidebar__footer">
          <div className="db-sidebar__user" aria-label={`Signed in as ${displayName}`}>
            <Avatar name={fullName} email={user?.email} />
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
          <Link to={home} className="db-mobile-brand" aria-label="Autara home">
            <LogoMark size={28} />
            <span className="db-mobile-brand__name">Autara</span>
          </Link>
          <div className="db-topnav__right">
            <NotificationBell />
            <UserMenu user={user} name={fullName} role={role} onLogout={handleLogout} />
          </div>
        </div>

        {/* Desktop top nav */}
        <header className="db-topnav" role="banner">
          <span className="db-topnav__page-title">{pageTitle}</span>
          <div className="db-topnav__right">
            <NotificationBell />
            <UserMenu user={user} name={fullName} role={role} onLogout={handleLogout} />
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
          {navItems.slice(0, 5).map(item => {
            const isActive = item.id === activeNav
            return (
              <Link
                key={item.id}
                to={item.href}
                className={`db-tab-btn${isActive ? ' db-tab-btn--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
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
