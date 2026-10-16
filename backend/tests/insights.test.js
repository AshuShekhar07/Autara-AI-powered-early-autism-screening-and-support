jest.mock('../lib/aiClient')
const aiClient = require('../lib/aiClient')
const app = require('../app')
const Insight = require('../models/Insight')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const AuditLog = require('../models/AuditLog')
const { AppError } = require('../utils/respond')
const { clearInstrumentCache } = require('../lib/instrument')
const { localFacets } = require('../lib/localTime')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)

const instrument = {
  instrument: 'MCHAT-R', wordingVerified: false,
  items: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, text: `Question text ${i + 1}?`, domain: 'joint_attention' })),
  domains: [{ key: 'joint_attention', label: 'Joint attention', items: [1] }],
}
const goodResult = (over = {}) => ({
  status: 'generated', model: 'test-llm', promptVersion: 'insight_v1', retrievedChunkIds: [], readingGrade: 5.2,
  insight: {
    summary: 'Clinician summary.', caregiverSummary: 'Plain words for the family.',
    flaggedAreas: [{ area: 'Joint attention', explanation: 'Items flagged.', evidence: [{ type: 'screening_response', id: '1' }], references: [] }],
    uncertainty: 'Parent-reported screening; not a diagnosis.',
  }, ...over,
})

let ids
beforeEach(async () => {
  await clearDb(); jest.resetAllMocks(); clearInstrumentCache()
  aiClient.instrument.mockResolvedValue(instrument)
  aiClient.insights.mockResolvedValue(goodResult())
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver')
  await makeUser('cl1', 'clinician', { verified: true }); await makeUser('cl2', 'clinician', { verified: true })
  await makeUser('th1', 'therapist', { verified: true })
  const child = await makeChild('cg1', { name: 'Alexandra Demo', careTeam: [{ uid: 'cl1', role: 'clinician' }, { uid: 'th1', role: 'therapist' }] })
  const s = await Screening.create({
    childId: child._id, submittedBy: 'cg1', childAgeMonths: 22, answers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 'yes'])),
    riskScore: 3, riskTier: 'medium', atRiskItems: [1, 7, 9], status: 'INSIGHTS_READY',
    domainBreakdown: [{ domain: 'joint_attention', label: 'Joint attention', atRiskCount: 3, totalItems: 7 }],
  })
  ids = { child: String(child._id), screening: String(s._id) }
})

const mkLog = (n, notes = '') => BehaviourLog.create({
  childId: ids.child, loggedBy: 'cg1', loggedByRole: 'caregiver', occurredAt: new Date(Date.now() - n * 3600_000),
  antecedent: { category: 'transition', notes }, behaviour: { category: 'meltdown_tantrum', description: notes }, consequence: { category: 'comforted' },
  intensity: 3, local: localFacets(new Date(), 0),
})

describe('POST /api/insights/generate', () => {
  it('sends only minimal, name-free evidence (≤20 logs, scrubbed notes, age in months)', async () => {
    for (let i = 0; i < 25; i++) await mkLog(i, i === 0 ? 'Alexandra cried after leaving the park with Alexandra\'s sister' : '')
    const res = await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })
    expect(res.status).toBe(201)

    const sent = aiClient.insights.mock.calls[0][0]
    const json = JSON.stringify(sent)
    expect(json).not.toMatch(/Alexandra|Demo/)                       // name never leaves Node
    expect(json).not.toMatch(/dob|birth|caregiverUid|cg1|cl1|email/i)
    expect(sent.screening.childAgeMonths).toBe(22)
    expect(sent.screening.answers).toHaveLength(20)
    expect(sent.screening.answers[0]).toEqual({ item: 1, text: 'Question text 1?', answer: 'yes', flagged: true })
    expect(sent.behaviour.recentLogs).toHaveLength(20)
    expect(sent.behaviour.recentLogs[0]).toMatchObject({ antecedent: 'transition', behaviour: 'meltdown_tantrum' })
    expect(sent.behaviour.recentLogs[0].notes).toContain('[child]')
    expect(sent.behaviour.summary.totalLogs).toBe(25)
    expect(Object.keys(sent.behaviour.recentLogs[0]).sort()).toEqual(
      ['antecedent', 'behaviour', 'consequence', 'durationMinutes', 'id', 'intensity', 'notes', 'occurredAt', 'setting'])
  })

  it('stores the insight (needs clinical review), opens the case, audits', async () => {
    const res = await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })
    const i = res.body.data.insight
    expect(i).toMatchObject({ status: 'generated', summary: 'Clinician summary.', clinicalReviewRequired: true, model: 'test-llm', promptVersion: 'insight_v1' })
    expect(i.disclaimer).toMatch(/screening aid, not a diagnosis/)
    expect((await Screening.findById(ids.screening)).status).toBe('UNDER_CLINICAL_REVIEW')
    const log = await AuditLog.findOne({ action: 'INSIGHT_GENERATED' })
    expect(log).toMatchObject({ actorUid: 'cl1', targetType: 'insight' })
  })

  it('is clinician-only and respects the care team', async () => {
    const body = { screeningId: ids.screening }
    expect((await http.post('/api/insights/generate', 'th1').send(body)).status).toBe(403)
    expect((await http.post('/api/insights/generate', 'cg1').send(body)).status).toBe(403)
    expect((await http.post('/api/insights/generate', 'cl2').send(body)).status).toBe(404)
    expect((await http.post('/api/insights/generate', 'cl1').send({ screeningId: 'nope' })).status).toBe(400)
    expect(aiClient.insights).not.toHaveBeenCalled()
  })

  it('refuses a reviewed (locked) screening or one that was never scored', async () => {
    await Screening.updateOne({ _id: ids.screening }, { status: 'REVIEWED' })
    expect((await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })).body.error.code).toBe('SCREENING_ALREADY_REVIEWED')
    await Screening.updateOne({ _id: ids.screening }, { status: 'PROCESSING_FAILED' })
    expect((await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })).status).toBe(409)
  })

  it('stores a FAILED insight (with reason codes only) when the validator rejected the model output', async () => {
    aiClient.insights.mockResolvedValue({ status: 'failed', insight: null, failureReasons: ['BANNED_PHRASE:has_condition'], model: 'test-llm', promptVersion: 'insight_v1', retrievedChunkIds: [] })
    const res = await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })
    expect(res.status).toBe(201)
    expect(res.body.data.insight).toMatchObject({ status: 'failed', failureReasons: ['BANNED_PHRASE:has_condition'], summary: '' })
  })

  it('returns 503 and stores nothing when the AI service is down', async () => {
    aiClient.insights.mockRejectedValue(new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'down'))
    const res = await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE')
    expect(await Insight.countDocuments()).toBe(0)
  })
})

describe('visibility and approval', () => {
  async function generated() {
    const res = await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })
    return res.body.data.insight.id
  }

  it('caregivers see NOTHING until a clinician approves, then only the plain-language summary', async () => {
    const id = await generated()
    const q = `/api/insights?screeningId=${ids.screening}`
    expect((await http.get(q, 'cg1')).body.data.insights).toEqual([])
    expect((await http.get(q, 'th1')).body.data.insights).toEqual([])            // therapists: reviewed only too
    expect((await http.get(q, 'cl1')).body.data.insights).toHaveLength(1)        // clinician sees generated ones

    const approved = await http.post(`/api/insights/${id}/approve`, 'cl1')
    expect(approved.status).toBe(200)
    expect(approved.body.data.insight).toMatchObject({ status: 'approved' })

    const care = (await http.get(q, 'cg1')).body.data.insights[0]
    expect(care.caregiverSummary).toBe('Plain words for the family.')
    expect(care.reviewedByClinician).toBe(true)
    expect(care.summary).toBeUndefined(); expect(care.flaggedAreas).toBeUndefined(); expect(care.uncertainty).toBeUndefined()
    expect(care.disclaimer).toMatch(/not a diagnosis/)

    const therapist = (await http.get(q, 'th1')).body.data.insights[0]
    expect(therapist.flaggedAreas[0].evidence[0]).toEqual({ type: 'screening_response', id: '1' })
    expect((await http.get(q, 'cg2')).status).toBe(404)
    expect((await http.get(q, 'cl2')).status).toBe(404)
  })

  it('approve is audited, clinician-only, care-team-only and only for generated insights', async () => {
    const id = await generated()
    expect((await http.post(`/api/insights/${id}/approve`, 'th1')).status).toBe(403)
    expect((await http.post(`/api/insights/${id}/approve`, 'cg1')).status).toBe(403)
    expect((await http.post(`/api/insights/${id}/approve`, 'cl2')).status).toBe(404)
    expect((await http.post(`/api/insights/${id}/approve`, 'cl1')).status).toBe(200)
    expect(await AuditLog.countDocuments({ action: 'INSIGHT_APPROVED', actorUid: 'cl1' })).toBe(1)
    expect((await http.post(`/api/insights/${id}/approve`, 'cl1')).body.error.code).toBe('INSIGHT_NOT_APPROVABLE')

    aiClient.insights.mockResolvedValue({ status: 'failed', failureReasons: ['INVALID_JSON'], retrievedChunkIds: [] })
    const failedId = (await http.post('/api/insights/generate', 'cl1').send({ screeningId: ids.screening })).body.data.insight.id
    expect((await http.post(`/api/insights/${failedId}/approve`, 'cl1')).status).toBe(409)
    expect((await http.post('/api/insights/zzz/approve', 'cl1')).status).toBe(404)
  })

  it('an approved insight shows up as a caregiver notification', async () => {
    const id = await generated()
    await http.post(`/api/insights/${id}/approve`, 'cl1')
    const n = (await http.get('/api/me/notifications', 'cg1')).body.data.notifications
    expect(n.map((x) => x.title)).toContain('New reviewed insight')
  })
})
