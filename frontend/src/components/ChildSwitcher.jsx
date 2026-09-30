import React from 'react'
import { useChildren } from '../context/ChildContext'
import { formatAgeMonths } from '../lib/format'
import './ChildSwitcher.css'

/** Dropdown to pick the active child. Renders nothing when there is only one (or none). */
export default function ChildSwitcher({ label = 'Child' }) {
  const { children, activeChild, setActiveId } = useChildren()
  if (children.length < 2) return null
  return (
    <div className="child-switcher">
      <label htmlFor="child-switcher-select">{label}</label>
      <select id="child-switcher-select" value={activeChild?.id || ''} onChange={(e) => setActiveId(e.target.value)}>
        {children.map((c) => <option key={c.id} value={c.id}>{c.name} · {formatAgeMonths(c.ageMonths)}</option>)}
      </select>
    </div>
  )
}
