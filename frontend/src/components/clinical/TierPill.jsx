import React from 'react'
import { TIER_COPY } from '../../lib/screeningCopy'
import './clinical.css'

/** Risk tier as a labelled pill (text + colour, never colour alone). */
export default function TierPill({ tier }) {
  if (!tier) return <span className="cl-tier">—</span>
  return <span className={`cl-tier cl-tier--${tier}`}>{TIER_COPY[tier]?.label || tier}</span>
}
