jest.mock('../lib/aiClient')
jest.mock('../lib/localScorer', () => {
  const actual = jest.requireActual('../lib/localScorer')
  return { ...actual, scoreLocally: jest.fn(actual.scoreLocally) }
})
const aiClient = require('../lib/aiClient')
const localScorer = require('../lib/localScorer')
const actualLocal = jest.requireActual('../lib/localScorer')
const app = require('../app')
const Screening = require('../models/Screening')
const { AppError } = require('../utils/respond')
const { canTransition, advance, TRANSITIONS } = require('../lib/screeningStatus')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(async () => {
  await clearDb(); jest.resetAllMocks()
  aiClient.screen.mockImplementation(fakeScore)
  localScorer.scoreLocally.mockImplementation(actualLocal.scoreLocally)
})

/** Test double for the AI service using the official rules (2,5,12 reverse-scored). */
async function fakeScore({ answers }) {
  const atRisk = []
  for (let n = 1; n <= 20; n++) {
    const reverse = [2, 5, 12].includes(n)
    if (reverse ? answers[n] === 'yes' : answers[n] === 'no') atRisk.push(n)
  }
  const riskScore = atRisk.length
  return {
    riskScore, riskTier: riskScore <= 2 ? 'low' : riskScore <= 7 ? 'medium' : 'high', atRiskItems: atRisk,
    domainBreakdown: [{ domain: 'joint_attention', label: 'JA', atRiskCount: atRisk.length, totalItems: 7 }],
    modelProbability: 0.42, modelVersion: 'test-model',
  }
}

const typical = () => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, [2, 5, 12].includes(i + 1) ? 'no' : 'yes']))
const riskyN = (n) => { const a = typical(); for (let i = 1; i <= n; i++) a[i] = [2, 5, 12].includes(i) ? 'yes' : 'no'; return a }

async function setup(ageMonths = 22) {
  await makeUser('cg1', 'caregiver')
  await makeUser('cg2', 'caregiver')
  await makeUser('cl1', 'clinician', { verified: true })
  const child = await makeChild('cg1', { ageMonths, careTeam: [{ uid: 'cl1', role: 'clinician' }] })
  return String(child._id)
}

describe('status lifecycle (single place)', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition('DRAFT', 'SCREENING_SUBMITTED')).toBe(true)
    expect(canTransition('PROCESSING', 'INSIGHTS_READY')).toBe(true)
    expect(canTransition('PROCESSING', 'PROCESSING_FAILED')).toBe(true)
    expect(canTransition('PROCESSING_FAILED', 'PROCESSING')).toBe(true)
    expect(canTransition('INSIGHTS_READY', 'UNDER_CLINICAL_REVIEW')).toBe(true)
    expect(canTransition('UNDER_CLINICAL_REVIEW', 'REVIEWED')).toBe(true)
    expect(canTransition('DRAFT', 'REVIEWED')).toBe(false)
    expect(canTransition('INSIGHTS_READY', 'REVIEWED')).toBe(false)
    expect(canTransition('REVIEWED', 'PROCESSING')).toBe(false)
    expect(TRANSITIONS.REVIEWED).toEqual([])
  })
  it('advance() throws 409 for illegal moves and records history', () => {
    const s = { status: 'DRAFT', statusHistory: [] }
    advance(s, 'SCREENING_SUBMITTED', 'u')
    expect(s.statusHistory).toHaveLength(1)
    expect(() => advance(s, 'REVIEWED')).toThrow(AppError)
    expect(s.status).toBe('SCREENING_SUBMITTED')
  })
})

describe('POST /api/screenings', () => {
  it('scores, stores and returns a result with the disclaimer (no probability for caregivers)', async () => {
    const childId = await setup()
    const res = await http.post('/api/screenings', 'cg1').send({ childId, answers: riskyN(8) })
    expect(res.status).toBe(201)
    const s = res.body.data.screening
    expect(s).toMatchObject({ status: 'INSIGHTS_READY', riskScore: 8, riskTier: 'high', childAgeMonths: 22 })
    expect(s.disclaimer).toMatch(/screening aid, not a diagnosis/)
    expect(s.modelProbability).toBeUndefined()
    expect(aiClient.screen).toHaveBeenCalledWith({ answers: expect.objectContaining({ 1: 'no' }) })
    const stored = await Screening.findById(s.id)
    expect(stored.statusHistory.map((h) => h.status)).toEqual(['DRAFT', 'SCREENING_SUBMITTED', 'PROCESSING', 'INSIGHTS_READY'])
  })

  it.each([[0, 'low'], [2, 'low'], [3, 'medium'], [7, 'medium'], [8, 'high']])('%i at-risk items → %s', async (n, tier) => {
    const childId = await setup()
    const res = await http.post('/api/screenings', 'cg1').send({ childId, answers: riskyN(n) })
    expect(res.body.data.screening.riskTier).toBe(tier)
  })

  it('rejects incomplete / invalid / unknown answers', async () => {
    const childId = await setup()
    const a = typical(); delete a[5]
    expect((await http.post('/api/screenings', 'cg1').send({ childId, answers: a })).body.error.code).toBe('INCOMPLETE_ANSWERS')
    expect((await http.post('/api/screenings', 'cg1').send({ childId, answers: { ...typical(), 3: 'maybe' } })).body.error.code).toBe('INVALID_ANSWERS')
    expect((await http.post('/api/screenings', 'cg1').send({ childId, answers: { ...typical(), 21: 'yes' } })).body.error.code).toBe('INVALID_ANSWERS')
    expect((await http.post('/api/screenings', 'cg1').send({ childId, answers: 'nope' })).status).toBe(400)
    expect(aiClient.screen).not.toHaveBeenCalled()
    expect(await Screening.countDocuments()).toBe(0)
  })

  it.each([[15, 400], [16, 201], [30, 201], [31, 400]])('child age %i months → %i', async (age, status) => {
    const childId = await setup(age)
    const res = await http.post('/api/screenings', 'cg1').send({ childId, answers: typical() })
    expect(res.status).toBe(status)
    if (status === 400) {
      expect(res.body.error.code).toBe('AGE_OUT_OF_RANGE')
      expect(res.body.error.details).toMatchObject({ childAgeMonths: age, minMonths: 16, maxMonths: 30 })
    }
  })

  it("cannot submit for someone else's child; clinicians cannot submit", async () => {
    const childId = await setup()
    expect((await http.post('/api/screenings', 'cg2').send({ childId, answers: typical() })).status).toBe(404)
    expect((await http.post('/api/screenings', 'cl1').send({ childId, answers: typical() })).status).toBe(403)
  })

  it('still scores (locally, with the same official rules) when the AI service is down', async () => {
    const childId = await setup()
    aiClient.screen.mockRejectedValue(new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'down'))
    const res = await http.post('/api/screenings', 'cg1').send({ childId, answers: riskyN(8) })
    expect(res.status).toBe(201)
    expect(res.body.data.screening).toMatchObject({ status: 'INSIGHTS_READY', riskScore: 8, riskTier: 'high', failureCode: null })
    const stored = await Screening.findById(res.body.data.screening.id)
    expect(stored.modelVersion).toBe('mchatr-rules-v1-local')
    expect(stored.modelProbability).toBeNull()
    expect(stored.atRiskItems).toHaveLength(8)
    expect(stored.domainBreakdown.reduce((n, d) => n + d.atRiskCount, 0)).toBe(8)
  })

  it('keeps the screening as PROCESSING_FAILED only if scoring fails everywhere, and retry recovers', async () => {
    const childId = await setup()
    aiClient.screen.mockRejectedValueOnce(new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'down'))
    localScorer.scoreLocally.mockImplementationOnce(() => { throw new Error('boom') })
    const res = await http.post('/api/screenings', 'cg1').send({ childId, answers: riskyN(3) })
    expect(res.status).toBe(201)
    expect(res.body.data.screening).toMatchObject({ status: 'PROCESSING_FAILED', failureCode: 'AI_SERVICE_UNAVAILABLE', riskScore: null })
    const id = res.body.data.screening.id

    const retry = await http.post(`/api/screenings/${id}/retry`, 'cg1')
    expect(retry.status).toBe(200)
    expect(retry.body.data.screening).toMatchObject({ status: 'INSIGHTS_READY', riskTier: 'medium' })

    const again = await http.post(`/api/screenings/${id}/retry`, 'cg1')
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION')
  })
})

describe('GET /api/screenings/instrument', () => {
  it('still returns the questionnaire when the AI service is down', async () => {
    await setup()
    aiClient.instrument.mockRejectedValue(new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'down'))
    require('../lib/instrument').clearInstrumentCache()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await http.get('/api/screenings/instrument', 'cg1')
    expect(res.status).toBe(200)
    expect(res.body.data.instrument.items).toHaveLength(20)
    expect(res.body.data.instrument.copyright).toMatch(/Diana Robins/)
  })
})

describe('reading screenings', () => {
  it('lists newest first with cursor pagination', async () => {
    const childId = await setup()
    for (let i = 0; i < 3; i++) {
      await http.post('/api/screenings', 'cg1').send({ childId, answers: riskyN(i) })
      await new Promise((r) => setTimeout(r, 5))
    }
    const p1 = await http.get(`/api/screenings?childId=${childId}&limit=2`, 'cg1')
    expect(p1.body.data.screenings.map((s) => s.riskScore)).toEqual([2, 1])
    const p2 = await http.get(`/api/screenings?childId=${childId}&limit=2&before=${encodeURIComponent(p1.body.data.nextBefore)}`, 'cg1')
    expect(p2.body.data.screenings.map((s) => s.riskScore)).toEqual([0])
    expect(p2.body.data.nextBefore).toBeNull()
  })

  it('requires childId and access to it', async () => {
    const childId = await setup()
    expect((await http.get('/api/screenings', 'cg1')).status).toBe(400)
    expect((await http.get(`/api/screenings?childId=${childId}`, 'cg2')).status).toBe(404)
  })

  it('care-team clinician sees the model probability; caregiver never does; strangers get 404', async () => {
    const childId = await setup()
    const id = (await http.post('/api/screenings', 'cg1').send({ childId, answers: riskyN(4) })).body.data.screening.id
    const clin = await http.get(`/api/screenings/${id}`, 'cl1')
    expect(clin.body.data.screening.modelProbability).toBe(0.42)
    const care = await http.get(`/api/screenings/${id}`, 'cg1')
    expect(care.body.data.screening.modelProbability).toBeUndefined()
    const other = await http.get(`/api/screenings/${id}`, 'cg2')
    expect(other.status).toBe(404)
    expect(other.body.error.code).toBe('SCREENING_NOT_FOUND')
    expect((await http.get('/api/screenings/zzz', 'cg1')).status).toBe(404)
  })
})
