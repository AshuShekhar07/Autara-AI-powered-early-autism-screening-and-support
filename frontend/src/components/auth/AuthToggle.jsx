import React from 'react'
import './AuthToggle.css'

/**
 * AuthToggle — two-tab switcher for "Log in" / "Sign up".
 *
 * Props:
 *   activeTab   'login' | 'signup'
 *   onChange    (tab: string) => void
 */
export default function AuthToggle({ activeTab, onChange }) {
  const tabs = [
    { id: 'login',  label: 'Log in'  },
    { id: 'signup', label: 'Sign up' },
  ]

  return (
    <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`auth-tab-${tab.id}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`auth-panel-${tab.id}`}
          className={`auth-toggle__btn${activeTab === tab.id ? ' auth-toggle__btn--active' : ''}`}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
