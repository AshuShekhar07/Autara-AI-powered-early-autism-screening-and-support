const { DISCLAIMER } = require('./disclaimer')

const COLUMNS = ['record_type', 'recorded_at', 'item', 'question_or_behaviour', 'answer', 'flagged',
  'antecedent', 'consequence', 'intensity', 'duration_minutes', 'setting', 'notes']

/** Quotes a cell and neutralises spreadsheet formula injection (=, +, -, @ at the start). */
function cell(v) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * One CSV: a disclaimer row, the 20 screening answers, then the behaviour logs.
 * `record_type` says which kind each row is (note | screening_answer | behaviour_log).
 */
function buildCsv({ screening, instrument, logs, labels }) {
  const rows = [COLUMNS]
  rows.push(['note', '', '', DISCLAIMER, '', '', '', '', '', '', '', ''])
  const flagged = new Set(screening.atRiskItems)
  for (const it of instrument.items) {
    rows.push(['screening_answer', new Date(screening.createdAt).toISOString(), it.number, it.text, screening.answers[String(it.number)], flagged.has(it.number) ? 'yes' : 'no', '', '', '', '', '', ''])
  }
  for (const l of logs) {
    rows.push([
      'behaviour_log', new Date(l.occurredAt).toISOString(), '', labels.behaviour(l.behaviour.category), '', '',
      labels.antecedent(l.antecedent.category), labels.consequence(l.consequence.category),
      l.intensity, l.durationMinutes ?? '', l.setting, [l.behaviour.description, l.antecedent.notes, l.consequence.notes].filter(Boolean).join(' | '),
    ])
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

module.exports = { buildCsv, cell, COLUMNS }
