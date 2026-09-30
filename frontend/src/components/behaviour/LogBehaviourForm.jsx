import React, { useId, useState } from 'react'
import { api } from '../../lib/api'
import { ANTECEDENTS, BEHAVIOURS, CONSEQUENCES, SETTINGS } from '../../lib/behaviourCategories'
import './behaviour.css'

/** <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm". */
function localInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ChipGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="bh-fieldset">
      <legend className="bh-legend">{legend}</legend>
      <div className="bh-chips">
        {options.map((o) => (
          <label key={o.value} className={`bh-chip${value === o.value ? ' bh-chip--on' : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Quick ABC entry: three chip questions + intensity are the only required inputs, everything
 * else lives under "Add details". Time defaults to now. Designed to take < 30 s on a phone.
 * Props: childId, onLogged(log)
 */
export default function LogBehaviourForm({ childId, onLogged }) {
  const uid = useId()
  const [antecedent, setAntecedent]   = useState('')
  const [behaviour, setBehaviour]     = useState('')
  const [consequence, setConsequence] = useState('')
  const [intensity, setIntensity]     = useState(3)
  const [when, setWhen]               = useState('')      // '' = now
  const [duration, setDuration]       = useState('')
  const [setting, setSetting]         = useState('home')
  const [aNotes, setANotes]           = useState('')
  const [bNotes, setBNotes]           = useState('')
  const [cNotes, setCNotes]           = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [saved, setSaved]             = useState(false)

  const ready = antecedent && behaviour && consequence

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    setSaving(true); setError(''); setSaved(false)
    try {
      const payload = {
        antecedent: { category: antecedent, notes: aNotes },
        behaviour: { category: behaviour, description: bNotes },
        consequence: { category: consequence, notes: cNotes },
        intensity, setting,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
      }
      if (when) payload.occurredAt = new Date(when).toISOString()
      if (duration !== '') payload.durationMinutes = Number(duration)
      const { log } = await api.post(`/api/children/${childId}/behaviour-logs`, payload)
      setAntecedent(''); setBehaviour(''); setConsequence(''); setIntensity(3)
      setWhen(''); setDuration(''); setANotes(''); setBNotes(''); setCNotes('')
      setSaved(true)
      onLogged?.(log)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <form className="bh-card bh-form" onSubmit={submit} aria-label="Log a behaviour">
      <div>
        <h2 className="bh-h2">Log a behaviour</h2>
        <p className="bh-muted">Tap one answer in each row. Details are optional — please avoid names.</p>
      </div>

      <ChipGroup legend="1 · What happened just before?" name={`${uid}-a`} options={ANTECEDENTS} value={antecedent} onChange={setAntecedent} />
      <ChipGroup legend="2 · What did they do?" name={`${uid}-b`} options={BEHAVIOURS} value={behaviour} onChange={setBehaviour} />
      <ChipGroup legend="3 · What happened right after?" name={`${uid}-c`} options={CONSEQUENCES} value={consequence} onChange={setConsequence} />

      <fieldset className="bh-fieldset">
        <legend className="bh-legend">How intense was it?</legend>
        <div className="bh-intensity">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`bh-chip bh-chip--num${intensity === n ? ' bh-chip--on' : ''}`}>
              <input type="radio" name={`${uid}-i`} value={n} checked={intensity === n} onChange={() => setIntensity(n)} />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <span className="bh-muted bh-scale"><span>1 = mild</span><span>5 = severe</span></span>
      </fieldset>

      <details className="bh-details">
        <summary>Add details (time, duration, notes)</summary>
        <div className="bh-detail-grid">
          <div className="field">
            <label htmlFor={`${uid}-when`}>When (leave empty for now)</label>
            <input id={`${uid}-when`} type="datetime-local" value={when} max={localInputValue()} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-dur`}>Lasted (minutes)</label>
            <input id={`${uid}-dur`} type="number" inputMode="numeric" min="0" max="1440" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-set`}>Where</label>
            <select id={`${uid}-set`} value={setting} onChange={(e) => setSetting(e.target.value)}>
              {SETTINGS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="field bh-span">
            <label htmlFor={`${uid}-bn`}>What it looked like</label>
            <input id={`${uid}-bn`} type="text" maxLength={500} value={bNotes} onChange={(e) => setBNotes(e.target.value)} placeholder="e.g. cried and dropped to the floor" />
          </div>
          <div className="field bh-span">
            <label htmlFor={`${uid}-an`}>What led up to it</label>
            <input id={`${uid}-an`} type="text" maxLength={500} value={aNotes} onChange={(e) => setANotes(e.target.value)} />
          </div>
          <div className="field bh-span">
            <label htmlFor={`${uid}-cn`}>What you did</label>
            <input id={`${uid}-cn`} type="text" maxLength={500} value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
          </div>
        </div>
      </details>

      {error && <div className="status-box status-box--error" role="alert">{error}</div>}
      {saved && <div className="status-box status-box--ok" role="status">Saved. Thank you — you can add another.</div>}

      <button type="submit" className="btn btn--primary" disabled={!ready || saving}>
        {saving ? 'Saving…' : 'Save entry'}
      </button>
    </form>
  )
}
