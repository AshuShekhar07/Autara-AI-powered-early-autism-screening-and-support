jest.mock('../lib/aiClient')
const aiClient = require('../lib/aiClient')
const pdfParse = require('pdf-parse')
const app = require('../app')
const Screening = require('../models/Screening')
const Insight = require('../models/Insight')
const BehaviourLog = require('../models/BehaviourLog')
const Report = require('../models/Report')
const AuditLog = require('../models/AuditLog')
const { clearInstrumentCache } = require('../lib/instrument')
const { buildCsv, cell } = require('../lib/reportCsv')
const { initialsOf } = require('../controllers/reportController')
const { localFacets } = require('../lib/localTime')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)

const instrument = {
  copyright: 'M-CHAT-R/F © 2009 Diana Robins, Deborah Fein, & Marianne Barton.', domainGroupingNote: 'Autara grouping, not part of the official instrument.',
  items: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, text: i === 6 ? '=HYPERLINK("http://evil","x") Question seven?' : `Question text ${i + 1}?`, domain: 'joint_attention' })),
  domains: [],
}

/** supertest helper: buffer the binary body */
const binary = (req) => req.buffer(true).parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))) })

let ids
beforeEach(async () => {
  await clearDb(); jest.resetAllMocks(); clearInstrumentCache()
  aiClient.instrument.mockResolvedValue(instrument)
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver')
  await makeUser('cl1', 'clinician', { verified: true }); await makeUser('cl2', 'clinician', { verified: true }); await makeUser('th1', 'therapist', { verified: true })
  const child = await makeChild('cg1', { name: 'Alexandra Demo', ageMonths: 22, careTeam: [{ uid: 'cl1', role: 'clinician' }, { uid: 'th1', role: 'therapist' }] })
  const s = await Screening.create({
    childId: child._id, submittedBy: 'cg1', childAgeMonths: 22, answers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'yes'])),
    riskScore: 3, riskTier: 'medium', atRiskItems: [1, 7, 9], status: 'UNDER_CLINICAL_REVIEW',
    domainBreakdown: [{ domain: 'joint_attention', label: 'Joint attention & sharing interest', atRiskCount: 3, totalItems: 7 }],
    clinicianReview: { annotations: [{ text: 'Discussed items with family.', by: 'cl1', at: new Date() }] },
  })
  await BehaviourLog.create({
    childId: child._id, loggedBy: 'cg1', loggedByRole: 'caregiver', occurredAt: new Date('2026-09-01T10:00:00Z'),
    antecedent: { category: 'transition', notes: '@sheet, "quoted"' }, behaviour: { category: 'meltdown_tantrum', description: 'Cried' },
    consequence: { category: 'comforted' }, intensity: 4, local: localFacets('2026-09-01T10:00:00Z', 0),
  })
  ids = { child: String(child._id), screening: String(s._id) }
})

const review = () => Screening.updateOne({ _id: ids.screening }, {
  status: 'REVIEWED', 'clinicianReview.reviewedAt': new Date(),
  'clinicianReview.override': { riskTier: 'low', originalTier: 'medium', reason: 'Observed in clinic.', by: 'cl1', at: new Date() },
})
const approvedInsight = () => Insight.create({
  screeningId: ids.screening, childId: ids.child, status: 'approved', generatedBy: 'cl1', approvedBy: 'cl1', approvedAt: new Date(),
  summary: 'CLINICIAN-SUMMARY-TEXT', caregiverSummary: 'FAMILY-SUMMARY-TEXT', uncertainty: 'UNCERTAINTY-TEXT',
  flaggedAreas: [{ area: 'Joint attention', explanation: 'EXPLANATION-TEXT', evidence: [{ type: 'screening_response', id: '7' }], references: [{ source: 'Approved Guide', page: 3, section: 'Screening' }] }],
})

const exportPdf = async (uid, body = {}) => binary(http.post('/api/reports/export', uid).send({ screeningId: ids.screening, format: 'pdf', ...body }))

describe('PDF export', () => {
  it('clinician PDF: initials + age, tier + override, domains, flagged items, behaviour table, approved insight w/ sources, annotations, disclaimer', async () => {
    await review(); await approvedInsight()
    const res = await exportPdf('cl1')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="autara-report-AD-\d{4}-\d{2}-\d{2}\.pdf"/)
    const text = (await pdfParse(res.body)).text

    expect(text).toContain('A.D.')
    expect(text).toContain('22 months')
    expect(text).not.toMatch(/Alexandra|Demo|cg1|@demo/)                       // no full name / identifiers
    expect(text).toMatch(/Medium risk/); expect(text).toMatch(/changed from Medium risk to Lower risk/); expect(text).toContain('Observed in clinic.')
    expect(text).toContain('Joint attention & sharing interest: 3 of 7 flagged')
    expect(text).toContain('not part of the official instrument')
    expect(text).toContain('Question text 1?'); expect(text).toContain('Question text 9?')
    expect(text).toMatch(/Behaviour[\s\S]*Entries[\s\S]*Meltdown/)
    expect(text).toContain('CLINICIAN-SUMMARY-TEXT'); expect(text).toContain('EXPLANATION-TEXT')
    expect(text).toContain('Approved Guide, p. 3'); expect(text).toContain('UNCERTAINTY-TEXT')
    expect(text).toContain('Discussed items with family.')
    expect(text).toMatch(/screening aid, not a diagnosis/)
    expect(text).not.toMatch(/has autism|is autistic|Level [123]/i)
  })

  it('caregiver PDF (reviewed only): plain-language summary, NO clinician annotations or AI detail', async () => {
    await review(); await approvedInsight()
    const res = await exportPdf('cg1')
    expect(res.status).toBe(200)
    const text = (await pdfParse(res.body)).text
    expect(text).toContain('FAMILY-SUMMARY-TEXT')
    expect(text).not.toMatch(/CLINICIAN-SUMMARY-TEXT|Discussed items with family|EXPLANATION-TEXT/)
    expect(text).toMatch(/screening aid, not a diagnosis/)
  })

  it('every page carries the disclaimer', async () => {
    await review()
    for (let i = 0; i < 40; i++) await Screening.updateOne({ _id: ids.screening }, { $push: { 'clinicianReview.annotations': { text: `Long annotation number ${i} `.repeat(6), by: 'cl1', at: new Date() } } })
    const res = await exportPdf('cl1')
    const parsed = await pdfParse(res.body)
    expect(parsed.numpages).toBeGreaterThan(1)
    expect((parsed.text.match(/screening aid, not a diagnosis\. Please discuss results with a qualified clinician\.\s*\|\s*Page/g) || []).length).toBe(parsed.numpages)
  })

  it('caregivers cannot export an un-reviewed screening; therapists never; strangers get 404', async () => {
    const early = await http.post('/api/reports/export', 'cg1').send({ screeningId: ids.screening, format: 'pdf' })
    expect(early.status).toBe(403); expect(early.body.error.code).toBe('REPORT_NOT_AVAILABLE')
    expect((await http.post('/api/reports/export', 'th1').send({ screeningId: ids.screening, format: 'pdf' })).status).toBe(403)
    await review()
    expect((await http.post('/api/reports/export', 'cg2').send({ screeningId: ids.screening, format: 'pdf' })).status).toBe(404)
    expect((await http.post('/api/reports/export', 'cl2').send({ screeningId: ids.screening, format: 'pdf' })).status).toBe(404)
    expect((await http.post('/api/reports/export', 'cl1').send({ screeningId: ids.screening, format: 'docx' })).status).toBe(400)
    expect((await http.post('/api/reports/export', 'cl1').send({ screeningId: 'nope', format: 'pdf' })).status).toBe(400)
  })

  it('clinicians can export a not-yet-reviewed screening; unscored ones are refused', async () => {
    expect((await exportPdf('cl1')).status).toBe(200)
    await Screening.updateOne({ _id: ids.screening }, { riskTier: null, status: 'PROCESSING_FAILED' })
    expect((await http.post('/api/reports/export', 'cl1').send({ screeningId: ids.screening, format: 'pdf' })).body.error.code).toBe('SCREENING_NOT_SCORED')
  })
})

describe('CSV export', () => {
  it('has a disclaimer row, the 20 answers and the behaviour logs, and neutralises formulas', async () => {
    await review()
    const res = await http.post('/api/reports/export', 'cg1').send({ screeningId: ids.screening, format: 'csv' })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/\.csv"/)
    const lines = res.text.trim().split('\r\n')
    expect(lines[0]).toBe('record_type,recorded_at,item,question_or_behaviour,answer,flagged,antecedent,consequence,intensity,duration_minutes,setting,notes')
    expect(lines[1]).toContain('screening aid, not a diagnosis')
    expect(lines.filter((l) => l.startsWith('screening_answer'))).toHaveLength(20)
    const item7 = lines.find((l) => l.startsWith('screening_answer') && l.includes(',7,'))
    expect(item7).toContain("'=HYPERLINK")                     // leading = neutralised
    expect(item7).toMatch(/,yes,yes,|,yes,yes/)                 // answer yes, flagged yes
    const log = lines.find((l) => l.startsWith('behaviour_log'))
    expect(log).toContain('Meltdown / tantrum'); expect(log).toContain('"Cried | @sheet, ""quoted"""')
    expect(res.text).not.toMatch(/Alexandra|Demo/)
  })

  it('cell() quotes and defuses', () => {
    expect(cell('=1+1')).toBe("'=1+1"); expect(cell('a,b')).toBe('"a,b"'); expect(cell('say "hi"')).toBe('"say ""hi"""'); expect(cell(null)).toBe('')
    expect(cell('-5')).toBe("'-5"); expect(cell(4)).toBe('4')
  })
})

describe('report history + audit', () => {
  it('records each export, lists history for anyone with child access, and audits', async () => {
    await review()
    await exportPdf('cg1'); await http.post('/api/reports/export', 'cl1').send({ screeningId: ids.screening, format: 'csv' })
    expect(await Report.countDocuments()).toBe(2)
    expect(await AuditLog.countDocuments({ action: 'REPORT_EXPORTED' })).toBe(2)

    const mine = await http.get(`/api/reports?childId=${ids.child}`, 'cg1')
    expect(mine.body.data.reports.map((r) => [r.format, r.generatedBy]).sort()).toEqual([['csv', 'care team'], ['pdf', 'you']])
    expect((await http.get(`/api/reports?childId=${ids.child}`, 'cl1')).body.data.reports).toHaveLength(2)
    expect((await http.get(`/api/reports?childId=${ids.child}`, 'cg2')).status).toBe(404)
    expect((await http.get('/api/reports', 'cg1')).status).toBe(400)
  })

  it('initialsOf never leaks more than initials', () => {
    expect(initialsOf('Alexandra Demo')).toBe('A.D.'); expect(initialsOf('  mary jane van dyke ')).toBe('M.J.V.D.'); expect(initialsOf('')).toBe('?')
  })
})
