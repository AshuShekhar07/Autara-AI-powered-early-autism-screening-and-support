const PDFDocument = require('pdfkit')
const { DISCLAIMER } = require('./disclaimer')

const TIER_LABEL = { low: 'Lower risk', medium: 'Medium risk', high: 'Higher risk' }
const INK = '#1F2E2B'
const MUTED = '#6B7370'
const BRAND = '#2F6F62'

/**
 * Renders the screening report. Contains: header, child INITIALS + age in months (never the full
 * name / date of birth), date, risk tier (+ clinician override), domain breakdown, flagged items,
 * behaviour summary table, approved insight with sources, (clinician copy only) annotations,
 * and the disclaimer in the footer of every page.
 *
 * `data` = { initials, ageMonths, screening, instrument, behaviour, insight, annotations, audience }
 *   audience: 'clinician' → full approved insight + annotations;  'caregiver' → plain-language summary only
 */
function renderReportPdf(data) {
  const doc = new PDFDocument({
    size: 'A4', margins: { top: 56, bottom: 64, left: 54, right: 54 }, bufferPages: true,
    compress: process.env.NODE_ENV !== 'test', // uncompressed in tests so text can be asserted
    info: { Title: 'Autara screening summary', Author: 'Autara', Subject: 'M-CHAT-R screening summary (screening aid, not a diagnosis)' },
  })
  const { screening: s, instrument, behaviour, insight, annotations = [], audience } = data
  const override = s.clinicianReview?.override
  const finalTier = override?.riskTier || s.riskTier

  const h1 = (t) => doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(13).text(t).moveDown(0.3).fillColor(INK).font('Helvetica').fontSize(10)
  const p = (t, opts = {}) => doc.fillColor(INK).font('Helvetica').fontSize(10).text(t, opts)
  const muted = (t) => doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(t)
  const section = () => doc.moveDown(0.9)

  // ── Header ──
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(20).text('Autara')
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text('Screening summary report (M-CHAT-R)')
  doc.moveDown(0.2)
  muted(`Child: ${data.initials}  ·  Age at screening: ${s.childAgeMonths} months  ·  Screening date: ${new Date(s.createdAt).toISOString().slice(0, 10)}  ·  Report date: ${new Date().toISOString().slice(0, 10)}`)
  doc.moveDown(0.8)
  const bannerY = doc.y
  doc.roundedRect(54, bannerY, 487, 32, 4).fill('#E8F0EE')
  doc.fillColor('#224F45').font('Helvetica-Bold').fontSize(10).text(DISCLAIMER, 62, bannerY + 11, { width: 471 })
  doc.x = 54
  doc.y = bannerY + 32 + 16

  // ── Risk tier ──
  h1('Result')
  p(`Questionnaire result: ${TIER_LABEL[s.riskTier]} — ${s.riskScore} of 20 answers flagged. ` +
    'A professional evaluation is ' + (s.riskTier === 'low' ? 'not suggested by this screening alone, but any concern should be discussed with a clinician.' : 'recommended.'))
  if (override) {
    p(`Clinician review: the tier was changed from ${TIER_LABEL[override.originalTier]} to ${TIER_LABEL[override.riskTier]}.`, { continued: false })
    p(`Reason: ${override.reason}`)
  }
  p(`Final tier shown to the family: ${TIER_LABEL[finalTier]}.`)
  if (s.status === 'REVIEWED') muted(`Reviewed by a clinician${s.clinicianReview?.reviewedAt ? ' on ' + new Date(s.clinicianReview.reviewedAt).toISOString().slice(0, 10) : ''}.`)
  else muted('This screening has not yet been marked as reviewed by a clinician.')
  section()

  // ── Domain breakdown ──
  h1('Flagged answers by area')
  muted(instrument.domainGroupingNote)
  doc.moveDown(0.3)
  for (const d of s.domainBreakdown) p(`•  ${d.label}: ${d.atRiskCount} of ${d.totalItems} flagged`)
  section()

  // ── Flagged items ──
  h1('Answers that counted toward the result')
  const byNumber = Object.fromEntries(instrument.items.map((i) => [i.number, i]))
  if (!s.atRiskItems.length) p('No answers were flagged.')
  for (const n of s.atRiskItems) {
    p(`${n}. ${byNumber[n]?.text}  —  answered ${s.answers[String(n)] === 'yes' ? 'Yes' : 'No'}`, { indent: 0 })
    doc.moveDown(0.2)
  }
  section()

  // ── Behaviour summary ──
  h1('Behaviour log summary')
  if (!behaviour.totalLogs) {
    p('No behaviour entries have been logged.')
  } else {
    p(`${behaviour.totalLogs} entries · average intensity ${behaviour.averageIntensity}/5`)
    doc.moveDown(0.3)
    const x = [54, 300, 380, 460]
    const row = (cells, bold) => {
      const y = doc.y
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK)
      cells.forEach((c, i) => doc.text(String(c), x[i], y, { width: (x[i + 1] || 541) - x[i] - 6, lineBreak: false }))
      doc.y = y + 15
    }
    row(['Behaviour', 'Entries', 'Avg intensity'], true)
    for (const b of behaviour.byBehaviour) row([behaviour.labels.behaviour(b.category), b.count, b.averageIntensity])
    doc.x = 54
    doc.moveDown(0.6)
    if (behaviour.topPairs.length) {
      doc.font('Helvetica-Bold').fontSize(10).text('Most common patterns (what came before, then the behaviour)', 54)
      doc.font('Helvetica')
      for (const pr of behaviour.topPairs) p(`•  ${behaviour.labels.antecedent(pr.antecedent)}, then ${behaviour.labels.behaviour(pr.behaviour)} (${pr.count} of ${behaviour.totalLogs})`)
    }
  }
  section()

  // ── Insight ──
  h1('AI-drafted insight (clinician-approved)')
  if (!insight) {
    p('No clinician-approved insight is available for this screening.')
  } else if (audience === 'clinician') {
    muted('Drafted by AI from the recorded answers and logs; approved by a clinician. Clinical judgement takes precedence.')
    doc.moveDown(0.3)
    p(insight.summary)
    doc.moveDown(0.4)
    for (const a of insight.flaggedAreas) {
      doc.font('Helvetica-Bold').text(a.area).font('Helvetica')
      p(a.explanation)
      const ev = a.evidence.map((e) => (e.type === 'screening_response' ? `answer ${e.id}` : `behaviour log ${String(e.id).slice(-6)}`)).join(', ')
      muted(`Evidence: ${ev}`)
      muted(`Sources: ${a.references.length ? a.references.map((r) => `${r.source}${r.page ? ', p. ' + r.page : ''}${r.section ? ' – ' + r.section : ''}`).join('; ') : 'none (patient evidence only)'}`)
      doc.moveDown(0.4)
    }
    doc.font('Helvetica-Bold').text('Uncertainty').font('Helvetica')
    p(insight.uncertainty)
  } else {
    p(insight.caregiverSummary)
    doc.moveDown(0.3)
    muted('This plain-language summary was drafted with AI and approved by your clinician.')
  }

  // ── Annotations (clinician copy only) ──
  if (audience === 'clinician') {
    section()
    h1('Clinician annotations')
    if (!annotations.length) p('None.')
    for (const a of annotations) p(`•  ${new Date(a.at).toISOString().slice(0, 10)} — ${a.text}`)
  }

  // ── Footer on every page ──
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const bottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0 // allow writing in the footer area without triggering a new page
    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text(`${DISCLAIMER}   |   Page ${i + 1} of ${range.count}`, 54, doc.page.height - 40, { width: 487, align: 'center', lineBreak: false })
    doc.page.margins.bottom = bottom
  }
  return doc
}

module.exports = { renderReportPdf, TIER_LABEL }
