import React, { useMemo, useState } from 'react'
import { ChartCard, Tip, BRAND, GRID, AXIS_TEXT, axisProps } from '../charts/shared'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { PERIODS, useBehaviourSummary } from '../../hooks/useBehaviourSummary'
import { formatDate } from '../../lib/format'
import { antecedentLabel, behaviourLabel, consequenceLabel, WEEKDAYS } from '../../lib/behaviourCategories'
import './behaviour.css'

/** Weekly count line (one series → no legend; title says what it is). */
export function WeeklyTrendChart({ summary, ...state }) {
  const data = (summary?.weeklyTrend || []).map((w) => ({ ...w, label: formatDate(w.weekStart, { day: 'numeric', month: 'short' }) }))
  return (
    <ChartCard {...state} title="Entries per week" subtitle="How often behaviours were logged each week"
      empty={!data.length || summary.totalLogs === 0} emptyText="Nothing logged in this period yet."
      table={{ columns: ['Week starting', 'Entries', 'Average intensity'], rows: data.map((w) => [w.label, w.count, w.averageIntensity ?? '—']) }}>
      <div className="bh-chart__plot" role="img" aria-label={`Line chart of entries per week. ${data.map((d) => `${d.label}: ${d.count}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
            <Tooltip cursor={{ stroke: GRID }} content={(p) => <Tip {...p} title={(r) => `Week of ${r.label}`}
              lines={(r) => [`${r.count} ${r.count === 1 ? 'entry' : 'entries'}`, r.averageIntensity ? `Average intensity ${r.averageIntensity}/5` : 'No entries']} />} />
            <Line type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2} dot={{ r: 4, fill: BRAND, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

/** Horizontal bars: how often each behaviour category occurred (value labelled at the tip). */
export function CategoryBarChart({ summary, ...state }) {
  const data = (summary?.byBehaviour || []).map((b) => ({ ...b, label: behaviourLabel(b.category) }))
  return (
    <ChartCard {...state} title="Behaviours by type" subtitle="Most frequent first"
      empty={!data.length} emptyText="Nothing logged in this period yet."
      table={{ columns: ['Behaviour', 'Entries', 'Average intensity'], rows: data.map((d) => [d.label, d.count, d.averageIntensity]) }}>
      <div className="bh-chart__plot" role="img" aria-label={`Bar chart of behaviours by type. ${data.map((d) => `${d.label}: ${d.count}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38 + 20)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }} barCategoryGap={10}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="label" width={150} {...axisProps} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(47,111,98,.06)' }} content={(p) => <Tip {...p} title={(r) => r.label}
              lines={(r) => [`${r.count} ${r.count === 1 ? 'entry' : 'entries'}`, `Average intensity ${r.averageIntensity}/5`]} />} />
            <Bar dataKey="count" fill={BRAND} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="count" position="right" fill={AXIS_TEXT} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

/** Time-of-day / day-of-week bars, switchable. */
export function TimeChart({ summary, ...state }) {
  const [mode, setMode] = useState('hour')
  const data = useMemo(() => {
    if (!summary) return []
    if (mode === 'hour') {
      return summary.byHour.map((h) => ({ ...h, label: h.hour % 3 === 0 ? `${h.hour % 12 || 12}${h.hour < 12 ? 'a' : 'p'}` : '', full: `${String(h.hour).padStart(2, '0')}:00–${String(h.hour).padStart(2, '0')}:59` }))
    }
    return summary.byWeekday.map((d) => ({ ...d, label: WEEKDAYS[d.weekday], full: WEEKDAYS[d.weekday] }))
  }, [summary, mode])
  const empty = !summary || summary.totalLogs === 0
  return (
    <ChartCard {...state} title={mode === 'hour' ? 'Time of day' : 'Day of the week'} subtitle="When behaviours tend to happen (your local time)"
      empty={empty} emptyText="Nothing logged in this period yet."
      table={{ columns: [mode === 'hour' ? 'Hour' : 'Day', 'Entries'], rows: data.map((d) => [d.full, d.count]) }}>
      <div className="bh-seg" role="group" aria-label="Group by">
        <button type="button" aria-pressed={mode === 'hour'} className={mode === 'hour' ? 'on' : ''} onClick={() => setMode('hour')}>Hour</button>
        <button type="button" aria-pressed={mode === 'weekday'} className={mode === 'weekday' ? 'on' : ''} onClick={() => setMode('weekday')}>Weekday</button>
      </div>
      <div className="bh-chart__plot" role="img" aria-label={`Bar chart by ${mode === 'hour' ? 'hour of day' : 'weekday'}. ${data.filter((d) => d.count).map((d) => `${d.full}: ${d.count}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={mode === 'hour' ? 3 : 12}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" interval={0} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(47,111,98,.06)' }} content={(p) => <Tip {...p} title={(r) => r.full} lines={(r) => [`${r.count} ${r.count === 1 ? 'entry' : 'entries'}`]} />} />
            <Bar dataKey="count" fill={BRAND} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

/**
 * Antecedent → behaviour heat table. Cell shade = count (single sequential brand hue),
 * the number is always printed in the cell so colour is never the only channel.
 * Rows/columns with no entries are hidden to keep it compact.
 */
export function TriggerMatrix({ summary, ...state }) {
  const view = useMemo(() => {
    if (!summary?.matrix?.length) return null
    const rows = [...new Set(summary.matrix.map((m) => m.antecedent))]
    const cols = [...new Set(summary.matrix.map((m) => m.behaviour))]
    const cell = Object.fromEntries(summary.matrix.map((m) => [`${m.antecedent}|${m.behaviour}`, m.count]))
    const max = Math.max(...summary.matrix.map((m) => m.count))
    return { rows, cols, cell, max }
  }, [summary])

  return (
    <ChartCard {...state} title="What tends to come before" subtitle="Rows: what happened before · Columns: what the child did. Darker = more often"
      empty={!view} emptyText="Log a few entries to see which triggers go with which behaviours.">
      {view && (
        <>
          <div className="bh-tablewrap">
            <table className="bh-table bh-heat">
              <caption className="bh-sr">Number of entries for each before-and-behaviour pair</caption>
              <thead><tr><th scope="col">Before ↓ / Behaviour →</th>{view.cols.map((c) => <th key={c} scope="col">{behaviourLabel(c)}</th>)}</tr></thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r}>
                    <th scope="row">{antecedentLabel(r)}</th>
                    {view.cols.map((c) => {
                      const n = view.cell[`${r}|${c}`] || 0
                      return <td key={c} style={{ background: n ? `rgba(47,111,98,${0.12 + 0.68 * (n / view.max)})` : 'transparent', color: n && n / view.max > 0.6 ? '#fff' : undefined }}
                                 aria-label={`${antecedentLabel(r)} then ${behaviourLabel(c)}: ${n}`}>{n || ''}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.topPairs.length > 0 && (
            <div className="bh-top">
              <h4 className="bh-h4">Most common patterns</h4>
              <ol>
                {summary.topPairs.map((p) => (
                  <li key={`${p.antecedent}|${p.behaviour}`}>
                    {antecedentLabel(p.antecedent)} → {behaviourLabel(p.behaviour)} <span className="bh-muted">({p.count} of {summary.totalLogs})</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {summary.consequencesByBehaviour.length > 0 && <ConsequenceList summary={summary} />}
        </>
      )}
    </ChartCard>
  )
}

function ConsequenceList({ summary }) {
  const top = summary.byBehaviour[0]?.category
  if (!top) return null
  const rows = summary.consequencesByBehaviour.filter((c) => c.behaviour === top).slice(0, 3)
  return (
    <div className="bh-top">
      <h4 className="bh-h4">What usually followed “{behaviourLabel(top)}”</h4>
      <ul>{rows.map((r) => <li key={r.consequence}>{consequenceLabel(r.consequence)} <span className="bh-muted">({r.count})</span></li>)}</ul>
    </div>
  )
}

/** Charts with a shared period selector. Props: childId, refreshKey, compact (2 charts only, for dashboards) */
export default function BehaviourCharts({ childId, refreshKey = 0, compact = false }) {
  const [period, setPeriod] = useState('6w')
  const { summary, loading, error, reload } = useBehaviourSummary(childId, period, refreshKey)
  const state = { summary, loading, error, onRetry: reload }
  return (
    <section aria-labelledby="bh-trends-h" className="bh-charts">
      <div className="bh-charts__head">
        <h2 className="bh-h2" id="bh-trends-h">Trends</h2>
        <div className="bh-seg" role="group" aria-label="Time period">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>
          ))}
        </div>
      </div>
      {summary && summary.totalLogs > 0 && (
        <p className="bh-muted" role="status">{summary.totalLogs} {summary.totalLogs === 1 ? 'entry' : 'entries'} · average intensity {summary.averageIntensity}/5</p>
      )}
      <div className={`bh-grid${compact ? " bh-grid--compact" : ""}`}>
        <WeeklyTrendChart {...state} />
        <CategoryBarChart {...state} />
        {!compact && <TimeChart {...state} />}
        {!compact && <TriggerMatrix {...state} />}
      </div>
    </section>
  )
}
