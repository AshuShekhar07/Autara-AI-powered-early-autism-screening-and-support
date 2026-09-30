process.env.ASK_RATE_LIMIT_PER_HOUR = '5'   // must be set before the app (and its route file) is loaded
jest.mock('../lib/aiClient')
const aiClient = require('../lib/aiClient')
const app = require('../app')
const Screening = require('../models/Screening')
const { rateLimit } = require('../lib/rateLimit')
const { limit } = require('../routes/assistant')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)

let childId
beforeEach(async () => {
  await clearDb(); jest.resetAllMocks(); limit.reset()
  aiClient.ask.mockResolvedValue({ answer: 'From the guide.', sources: [{ title: 'Guide', publisher: 'P', url: 'u', version: '1', page: 2, section: '' }], guardrail: null })
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver'); await makeUser('cl1', 'clinician', { verified: true })
  childId = String((await makeChild('cg1', { name: 'Alexandra Demo' }))._id)
})

const review = (over = {}) => Screening.create({
  childId, submittedBy: 'cg1', childAgeMonths: 22, answers: { 1: 'no' }, riskScore: 4, riskTier: 'medium', atRiskItems: [1],
  domainBreakdown: [{ domain: 'joint_attention', label: 'Joint attention', atRiskCount: 3, totalItems: 7 }], status: 'REVIEWED', ...over,
})

describe('POST /api/assistant/ask', () => {
  it('is for caregivers/patients only and validates the question', async () => {
    expect((await http.post('/api/assistant/ask', 'cl1').send({ question: 'hi' })).status).toBe(403)
    expect((await http.post('/api/assistant/ask').send({ question: 'hi' })).status).toBe(401)
    expect((await http.post('/api/assistant/ask', 'cg1').send({ question: '   ' })).status).toBe(400)
    expect((await http.post('/api/assistant/ask', 'cg1').send({ question: 'x'.repeat(501) })).status).toBe(400)
    expect((await http.post('/api/assistant/ask', 'cg1').send({ question: { $ne: 1 } })).status).toBe(400)
    expect((await http.post('/api/assistant/ask', 'cg1').send({ question: 'ok', childId: 'nope' })).status).toBe(400)
    expect(aiClient.ask).not.toHaveBeenCalled()
  })

  it('always returns sources, the disclaimer and passes guardrail results through', async () => {
    const res = await http.post('/api/assistant/ask', 'cg1').send({ question: 'What is a follow-up interview?' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ answer: 'From the guide.', guardrail: null, usedChildContext: false })
    expect(res.body.data.sources).toHaveLength(1)
    expect(res.body.data.disclaimer).toMatch(/not a diagnosis/)

    aiClient.ask.mockResolvedValue({ answer: 'No reference material has been loaded yet', guardrail: 'no_sources' })   // sources omitted upstream
    const empty = await http.post('/api/assistant/ask', 'cg1').send({ question: 'Anything?' })
    expect(empty.body.data.sources).toEqual([])
    expect(empty.body.data.guardrail).toBe('no_sources')
  })

  it("sends only the latest REVIEWED screening's tier + domains as context (no name, no answers)", async () => {
    await review({ riskTier: 'high', riskScore: 9, createdAt: new Date(Date.now() - 86400000), clinicianReview: { override: { riskTier: 'medium', originalTier: 'high', reason: 'because', by: 'cl1' } } })
    await review({ status: 'INSIGHTS_READY', riskTier: 'low', riskScore: 1 })          // newest but NOT reviewed → ignored
    const res = await http.post('/api/assistant/ask', 'cg1').send({ question: 'What does this mean?', childId })
    expect(res.body.data.usedChildContext).toBe(true)
    const payload = aiClient.ask.mock.calls[0][0]
    expect(payload).toEqual({
      question: 'What does this mean?',
      context: { riskTier: 'medium', ageMonths: 22, domains: [{ label: 'Joint attention', atRiskCount: 3, totalItems: 7 }] },
    })
    expect(JSON.stringify(payload)).not.toMatch(/Alexandra|Demo|answers|childId/)
  })

  it('no context without a reviewed screening; cannot use another caregiver\'s child', async () => {
    await review({ status: 'INSIGHTS_READY' })
    const res = await http.post('/api/assistant/ask', 'cg1').send({ question: 'Hello?', childId })
    expect(res.body.data.usedChildContext).toBe(false)
    expect(aiClient.ask.mock.calls[0][0].context).toBeUndefined()
    expect((await http.post('/api/assistant/ask', 'cg2').send({ question: 'Hello?', childId })).status).toBe(404)
  })

  it('is rate limited per user (429 + Retry-After) — limit set to 5/hour in this file', async () => {
    for (let i = 0; i < 5; i++) expect((await http.post('/api/assistant/ask', 'cg1').send({ question: `q${i}` })).status).toBe(200)
    const blocked = await http.post('/api/assistant/ask', 'cg1').send({ question: 'one too many' })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    expect((await http.post('/api/assistant/ask', 'cg2').send({ question: 'other user unaffected' })).status).toBe(200)
    expect(aiClient.ask).toHaveBeenCalledTimes(6)
  })
})

describe('rateLimit window', () => {
  it('lets requests through again once the window has passed', () => {
    let t = 0
    const limiter = rateLimit({ max: 2, windowMs: 1000, key: () => 'u', now: () => t })
    const run = () => { let err; limiter({}, { set() {} }, (e) => { err = e }); return err }
    expect(run()).toBeUndefined(); expect(run()).toBeUndefined()
    expect(run().code).toBe('RATE_LIMITED')
    t = 1001
    expect(run()).toBeUndefined()
  })
})
