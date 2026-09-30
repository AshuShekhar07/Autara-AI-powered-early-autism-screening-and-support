const app = require('../app')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const { localFacets } = require('../lib/localTime')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

async function world() {
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver')
  await makeUser('th1', 'therapist', { verified: true }); await makeUser('cl1', 'clinician', { verified: true })
  await makeUser('adm', 'admin'); await makeUser('cl-pending', 'clinician')
  const child = await makeChild('cg1', { careTeam: [{ uid: 'th1', role: 'therapist' }, { uid: 'cl1', role: 'clinician' }] })
  return String(child._id)
}
const log = (childId, when, by = 'cg1', role = 'caregiver') => BehaviourLog.create({
  childId, loggedBy: by, loggedByRole: role, occurredAt: when, antecedent: { category: 'transition' },
  behaviour: { category: 'meltdown_tantrum' }, consequence: { category: 'comforted' }, intensity: 3, local: localFacets(when, 0),
})
const screening = (childId, over = {}) => Screening.create({
  childId, submittedBy: 'cg1', childAgeMonths: 22, answers: {}, riskScore: 4, riskTier: 'medium', status: 'INSIGHTS_READY', ...over,
})

describe('milestones', () => {
  it('persists statuses per child with defaults; owner-only writes', async () => {
    const id = await world()
    expect((await http.get(`/api/children/${id}/milestones`, 'cg1')).body.data.statuses)
      .toEqual({ language: 'not_reviewed', social: 'not_reviewed', motor: 'not_reviewed', cognitive: 'not_reviewed', adaptive: 'not_reviewed' })
    const put = await http.put(`/api/children/${id}/milestones`, 'cg1').send({ statuses: { language: 'reviewed', motor: 'in_progress' } })
    expect(put.body.data.statuses).toMatchObject({ language: 'reviewed', motor: 'in_progress', social: 'not_reviewed' })
    expect((await http.get(`/api/children/${id}/milestones`, 'cg1')).body.data.statuses.language).toBe('reviewed')
    expect((await http.put(`/api/children/${id}/milestones`, 'cg1').send({ statuses: { language: 'bogus' } })).status).toBe(400)
    expect((await http.put(`/api/children/${id}/milestones`, 'cg1').send({ statuses: { flying: 'reviewed' } })).status).toBe(400)
    expect((await http.put(`/api/children/${id}/milestones`, 'th1').send({ statuses: { language: 'reviewed' } })).status).toBe(403)
    expect((await http.put(`/api/children/${id}/milestones`, 'cg2').send({ statuses: { language: 'reviewed' } })).status).toBe(404)
  })
})

describe('session notes', () => {
  it('therapist writes; therapist + clinician read; caregiver cannot', async () => {
    const id = await world()
    const created = await http.post(`/api/children/${id}/session-notes`, 'th1').send({ text: 'Practised turn-taking with blocks.' })
    expect(created.status).toBe(201)
    expect(created.body.data.note).toMatchObject({ authorUid: 'th1', authorName: 'Demo th1' })
    expect((await http.post(`/api/children/${id}/session-notes`, 'th1').send({ text: '' })).status).toBe(400)
    expect((await http.post(`/api/children/${id}/session-notes`, 'cl1').send({ text: 'x' })).status).toBe(403)
    expect((await http.post(`/api/children/${id}/session-notes`, 'cg1').send({ text: 'x' })).status).toBe(403)
    expect((await http.get(`/api/children/${id}/session-notes`, 'cl1')).body.data.notes).toHaveLength(1)
    expect((await http.get(`/api/children/${id}/session-notes`, 'th1')).body.data.notes).toHaveLength(1)
    expect((await http.get(`/api/children/${id}/session-notes`, 'cg1')).status).toBe(403)
    expect((await http.get(`/api/children/${id}/session-notes`, 'cl-pending')).status).toBe(403)
  })
})

describe('caseload', () => {
  it('shows last log, last screening tier (override wins) and awaiting-review flag', async () => {
    const id = await world()
    await log(id, new Date(Date.now() - 3 * 86400000)); const latestLog = new Date(Date.now() - 86400000); await log(id, latestLog)
    await screening(id, { riskTier: 'high', riskScore: 9, status: 'REVIEWED', createdAt: new Date(Date.now() - 5 * 86400000), clinicianReview: { override: { riskTier: 'medium', originalTier: 'high', reason: 'reason text', by: 'cl1' } } })
    await screening(id, { riskTier: 'low', riskScore: 1 }) // newest, awaiting review
    const res = await http.get('/api/me/caseload', 'th1')
    const row = res.body.data.children[0]
    expect(row).toMatchObject({ id, ageMonths: 22, myRole: 'therapist', awaitingReview: true })
    expect(new Date(row.lastLogAt).getTime()).toBe(latestLog.getTime())
    expect(row.lastScreening.tier).toBe('low')
  })
})

describe('caregiver overview', () => {
  it('returns trend, logs this week and sensible open actions', async () => {
    const id = await world()
    let res = await http.get(`/api/children/${id}/overview`, 'cg1')
    expect(res.body.data.overview.lastScreening).toBeNull()
    expect(res.body.data.overview.openActions.map((a) => a.id)).toEqual(expect.arrayContaining(['first-screening', 'log']))

    await screening(id, { riskScore: 3, riskTier: 'medium', createdAt: new Date(Date.now() - 20 * 86400000), status: 'REVIEWED' })
    await screening(id, { riskScore: 8, riskTier: 'high' })
    await log(id, new Date())
    res = await http.get(`/api/children/${id}/overview`, 'cg1')
    const o = res.body.data.overview
    expect(o.screeningTrend.map((t) => t.score)).toEqual([3, 8])   // ascending by date
    expect(o.lastScreening).toMatchObject({ effectiveRiskTier: 'high', riskScore: 8 })
    expect(o.logsThisWeek).toBe(1)
    expect(o.openActions.map((a) => a.id)).toContain('awaiting-review')
    expect(o.openActions.map((a) => a.id)).not.toContain('log')

    expect((await http.get(`/api/children/${id}/overview`, 'cg2')).status).toBe(404)
    expect((await http.get(`/api/children/${id}/overview`, 'th1')).status).toBe(403)
  })

  it('suggests adding a care team when the latest tier is medium/high and there is none', async () => {
    await makeUser('cg1', 'caregiver')
    const id = String((await makeChild('cg1'))._id)
    await screening(id, { riskTier: 'high', riskScore: 10 })
    const o = (await http.get(`/api/children/${id}/overview`, 'cg1')).body.data.overview
    expect(o.openActions.map((a) => a.id)).toContain('add-care-team')
  })
})

describe('timeline', () => {
  it('merges screenings, reviews, logs and (professionals only) notes/annotations', async () => {
    const id = await world()
    const s = await screening(id, { status: 'REVIEWED', createdAt: new Date(Date.now() - 4 * 86400000), clinicianReview: { reviewedAt: new Date(Date.now() - 3 * 86400000), annotations: [{ text: 'secret annotation', by: 'cl1', at: new Date(Date.now() - 3.5 * 86400000) }] } })
    await log(id, new Date(Date.now() - 2 * 86400000))
    await http.post(`/api/children/${id}/session-notes`, 'th1').send({ text: 'private session note' })

    const clin = (await http.get(`/api/children/${id}/timeline`, 'cl1')).body.data.events
    expect(clin.map((e) => e.type)).toEqual(['session_note', 'behaviour_log', 'review', 'annotation', 'screening'])
    expect(clin.find((e) => e.type === 'screening').ref).toEqual({ kind: 'screening', id: String(s._id) })

    const care = (await http.get(`/api/children/${id}/timeline`, 'cg1')).body.data.events
    expect(care.map((e) => e.type)).toEqual(['behaviour_log', 'review', 'screening'])
    expect(JSON.stringify(care)).not.toMatch(/secret annotation|private session note/)
    expect((await http.get(`/api/children/${id}/timeline`, 'cg2')).status).toBe(404)
  })
})

describe('notifications (derived from real data)', () => {
  it('caregiver sees recent reviews; clinician sees queue size; admin sees verification queue', async () => {
    const id = await world()
    await screening(id, { status: 'REVIEWED', clinicianReview: { reviewedAt: new Date() } })
    await screening(id, { status: 'PROCESSING_FAILED', riskTier: undefined, riskScore: undefined })
    const care = (await http.get('/api/me/notifications', 'cg1')).body.data.notifications
    expect(care.map((n) => n.title).sort()).toEqual(['Screening needs a retry', 'Screening reviewed'])
    expect((await http.get('/api/me/notifications', 'cg2')).body.data.notifications).toEqual([])

    await screening(id)
    expect((await http.get('/api/me/notifications', 'cl1')).body.data.notifications[0].message).toMatch(/1 screening waiting/)
    expect((await http.get('/api/me/notifications', 'adm')).body.data.notifications[0].message).toMatch(/1 professional account/)
    expect((await http.get('/api/me/notifications', 'th1')).body.data.notifications).toEqual([])
  })
})
