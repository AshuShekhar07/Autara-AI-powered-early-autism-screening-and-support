import React from 'react'
import './RoleSelector.css'

const ROLES = [
  { id: 'caregiver',  label: 'Caregiver'  },
  { id: 'patient',    label: 'Patient'     },
  { id: 'therapist',  label: 'Therapist'   },
  { id: 'clinician',  label: 'Clinician'   },
]

/**
 * RoleSelector — segmented control for choosing a signup role.
 *
 * Props:
 *   value      string  — currently selected role id
 *   onChange   (roleId: string) => void
 *
 * Accessibility: group labelled with role="radiogroup"; each segment is role="radio"
 * with aria-checked, so keyboard users can arrow-key through options.
 */
export default function RoleSelector({ value, onChange }) {
  function handleKeyDown(e, roleId, idx) {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % ROLES.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + ROLES.length) % ROLES.length
    } else {
      return
    }
    e.preventDefault()
    onChange(ROLES[next].id)
    document.getElementById(`role-option-${ROLES[next].id}`)?.focus()
  }

  return (
    <fieldset className="role-selector" aria-label="Select your role">
      <legend className="role-selector__legend">I am a…</legend>
      <div className="role-selector__track" role="radiogroup" aria-label="Role">
        {ROLES.map((r, idx) => (
          <button
            key={r.id}
            id={`role-option-${r.id}`}
            type="button"
            role="radio"
            aria-checked={value === r.id}
            className={`role-selector__option${value === r.id ? ' role-selector__option--active' : ''}`}
            onClick={() => onChange(r.id)}
            onKeyDown={(e) => handleKeyDown(e, r.id, idx)}
            tabIndex={value === r.id ? 0 : -1}
          >
            {r.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
