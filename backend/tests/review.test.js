const app = require('../app')
const Screening = require('../models/Screening')
const AuditLog = require('../models/AuditLog')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

async function world() {
  await makeUser('cg1', 'caregiver')
  await makeUser('cl1', 'clinician', { verified: true })
  await makeUser('cl2', 'clinician', { verified: true }) // not on the team
  await makeUser('th1', 'therapist', { verified: true })
  const child = await makeChild('cg1', { careTeam: [{ uid: 'cl1', role: 'clinician' }, { uid: 'th1', role: 'therapist' }] })
  return child
}

async function makeScreening(childId, { tier = 'medium', score = 4, status = 'INSIGHTS_READY', createdAt } = {}) {
  return Screening.create({
    childId, submittedBy: 'cg1', childAgeMonths: 22, answers: { 1: 'no' }, riskScore: score, riskTier: tier,
    atRiskItems: [1], domainBreakdown: [], status, ...(createdAt ? { createdAt } : {}),
    statusHistory: [{ status, at: new Date(), by: 'system' }],
  })
}

describe('clinician review workflow', () => {
  it('opening a case moves INSIGHTS_READY → UNDER_CLINICAL_REVIEW (idempotent, audited once)', async () => {
    const child = await world(); const s = await makeScreening(child._id)
    const a = await http.post(`/api/screenings/${s._id}/open`, 'cl1')
    expect(a.status).toBe(200)
    expect(a.body.data.screening.status).toBe('UNDER_CLINICAL_REVIEW')
    await http.post(`/api/screenings/${s._id}/open`, 'cl1')
    expect(await AuditLog.countDocuments({ action: 'SCREENING_REVIEW_STARTED' })).toBe(1)
  })

  it('therapists, caregivers and non-team clinicians cannot act', async () => {
    const child = await world(); const s = await makeScreening(child._id)
    for (const path of ['open', 'review']) {
      expect((await http.post(`/api/screenings/${s._id}/${path}`, 'th1')).status).toBe(403)
      expect((await http.post(`/api/screenings/${s._id}/${path}`, 'cg1')).status).toBe(403)
      expect((await http.post(`/api/screenings/${s._id}/${path}`, 'cl2')).status).toBe(404)
    }
    expect((await http.post(`/api/screenings/${s._id}/override`, 'th1').send({ riskTier: 'low', reason: 'nope nope' })).status).toBe(403)
    expect((await Screening.findById(s._id)).status).toBe('INSIGHTS_READY')
  })

  it('annotations are stored and audited', async () => {
    const child = await world(); const s = await makeScreening(child._id)
    const res = await http.post(`/api/screenings/${s._id}/annotations`, 'cl1').send({ text: 'Discussed items 1 and 7 with family.' })
    expect(res.status).toBe(200)
    expect(res.body.data.screening.status).toBe('UNDER_CLINICAL_REVIEW') // auto-opened
    expect(res.body.data.screening.clinicianReview.annotations[0]).toMatchObject({ text: expect.stringContaining('items 1 and 7'), by: 'cl1' })
    expect((await http.post(`/api/screenings/${s._id}/annotations`, 'cl1').send({ text: '  ' })).status).toBe(400)
    expect(await AuditLog.countDocuments({ action: 'SCREENING_ANNOTATED' })).toBe(1)
  })

  it('override needs a reason, stores both values, audits from→to', async () => {
    const child = await world(); const s = await makeScreening(child._id, { tier: 'high', score: 9 })
    expect((await http.post(`/api/screenings/${s._id}/override`, 'cl1').send({ riskTier: 'medium' })).body.error.code).toBe('REASON_REQUIRED')
    expect((await http.post(`/api/screenings/${s._id}/override`, 'cl1').send({ riskTier: 'medium', reason: 'no' })).body.error.code).toBe('REASON_REQUIRED')
    expect((await http.post(`/api/screenings/${s._id}/override`, 'cl1').send({ riskTier: 'severe', reason: 'valid reason' })).status).toBe(400)
    expect((await http.post(`/api/screenings/${s._id}/override`, 'cl1').send({ riskTier: 'high', reason: 'same tier' })).body.error.code).toBe('NO_CHANGE')

    const res = await http.post(`/api/screenings/${s._id}/override`, 'cl1').send({ riskTier: 'medium', reason: 'Follow-up interview did not confirm items 6 and 7.' })
    expect(res.status).toBe(200)
    const view = res.body.data.screening
    expect(view.riskTier).toBe('high')                       // original rule tier untouched
    expect(view.effectiveRiskTier).toBe('medium')
    expect(view.clinicianReview.override).toMatchObject({ originalTier: 'high', riskTier: 'medium', by: 'cl1' })
    const log = await AuditLog.findOne({ action: 'SCREENING_OVERRIDDEN' })
    expect(log.meta).toEqual({ from: 'high', to: 'medium' })
  })

  it('mark reviewed locks the screening; caregiver then sees override + reason but never annotations', async () => {
    const child = await world(); const s = await makeScreening(child._id, { tier: 'high', score: 9 })
    await http.post(`/api/screenings/${s._id}/annotations`, 'cl1').send({ text: 'Internal clinical note.' })
    await http.post(`/api/screenings/${s._id}/override`, 'cl1').send({ riskTier: 'medium', reason: 'Observed in clinic.' })

    const before = await http.get(`/api/screenings/${s._id}`, 'cg1')
    expect(before.body.data.screening.clinicianReview).toBeNull()       // not reviewed yet → hidden
    expect(before.body.data.screening.effectiveRiskTier).toBe('high')

    const done = await http.post(`/api/screenings/${s._id}/review`, 'cl1')
    expect(done.body.data.screening.status).toBe('REVIEWED')
    expect(done.body.data.screening.clinicianReview.reviewedAt).toBeTruthy()

    const after = (await http.get(`/api/screenings/${s._id}`, 'cg1')).body.data.screening
    expect(after.effectiveRiskTier).toBe('medium')
    expect(after.clinicianReview.override).toMatchObject({ originalTier: 'high', riskTier: 'medium', reason: 'Observed in clinic.' })
    expect(JSON.stringify(after)).not.toMatch(/Internal clinical note|annotations/)

    const locked = await http.post(`/api/screenings/${s._id}/annotations`, 'cl1').send({ text: 'late' })
    expect(locked.status).toBe(409)
    expect(locked.body.error.code).toBe('SCREENING_ALREADY_REVIEWED')
    expect(await AuditLog.countDocuments({ action: 'SCREENING_REVIEWED' })).toBe(1)
  })

  it('cannot review a screening that failed scoring', async () => {
    const child = await world(); const s = await makeScreening(child._id, { status: 'PROCESSING_FAILED' })
    expect((await http.post(`/api/screenings/${s._id}/review`, 'cl1')).body.error.code).toBe('INVALID_STATUS_TRANSITION')
  })
})

describe('review queue', () => {
  it('lists only caseload cases, high risk first then oldest first', async () => {
    const child = await world()
    const other = await makeChild('cg1', { name: 'Not on cl1 team' })
    const day = 86400000
    await makeScreening(child._id, { tier: 'low', score: 1, createdAt: new Date(Date.now() - 9 * day) })
    await makeScreening(child._id, { tier: 'medium', score: 4, createdAt: new Date(Date.now() - 2 * day) })
    await makeScreening(child._id, { tier: 'medium', score: 5, createdAt: new Date(Date.now() - 6 * day) })
    await makeScreening(child._id, { tier: 'high', score: 12, createdAt: new Date(Date.now() - 1 * day), status: 'UNDER_CLINICAL_REVIEW' })
    await makeScreening(child._id, { tier: 'high', score: 10, status: 'REVIEWED' })          // done → not in queue
    await makeScreening(other._id, { tier: 'high', score: 15 })                              // not my child

    const res = await http.get('/api/me/review-queue', 'cl1')
    expect(res.status).toBe(200)
    expect(res.body.data.queue.map((q) => [q.riskTier, q.riskScore])).toEqual([['high', 12], ['medium', 5], ['medium', 4], ['low', 1]])
    expect(res.body.data.queue[1].waitingDays).toBe(6)
    expect((await http.get('/api/me/review-queue', 'th1')).status).toBe(403)
    expect((await http.get('/api/me/review-queue', 'cg1')).status).toBe(403)
  })
})
