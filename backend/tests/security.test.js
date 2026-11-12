// Penetration-style regression tests: each case tries to break something and asserts the SAFE outcome.
jest.mock('../lib/aiClient')
const request = require('supertest')
const aiClient = require('../lib/aiClient')
const app = require('../app')
const User = require('../models/User')
const Child = require('../models/Child')
const Screening = require('../models/Screening')
const Insight = require('../models/Insight')
const BehaviourLog = require('../models/BehaviourLog')
const { clearInstrumentCache } = require('../lib/instrument')
const { localFacets } = require('../lib/localTime')
const { scrub } = require('../lib/evidenceBuilder')
const { connectTestDb, disconnectTestDb, clearDb, api, bearer, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)

const instrument = {
  instrument: 'MCHAT-R', wordingVerified: true,
  items: Array.from({ length: 20 }, (_, i) => ({ number: i + 1, text: `Question ${i + 1}?`, domain: 'joint_attention' })),
  domains: [{ key: 'joint_attention', label: 'Joint attention', items: [1] }],
}
const answers = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), 'yes']))

let w // ids of the "world"
beforeEach(async () => {
  await clearDb(); jest.resetAllMocks(); clearInstrumentCache()
  aiClient.instrument.mockResolvedValue(instrument)
  aiClient.ask.mockResolvedValue({ answer: 'ok', sources: [], guardrail: null })
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver')
  await makeUser('cl1', 'clinician', { verified: true }); await makeUser('cl2', 'clinician', { verified: true })
  await makeUser('th1', 'therapist', { verified: true }); await makeUser('adm', 'admin')
  const child = await makeChild('cg1', { careTeam: [{ uid: 'cl1', role: 'clinician' }, { uid: 'th1', role: 'therapist' }] })
  const screening = await Screening.create({
    childId: child._id, submittedBy: 'cg1', childAgeMonths: 22, answers, riskScore: 3, riskTier: 'medium',
    atRiskItems: [1], domainBreakdown: [], status: 'INSIGHTS_READY',
  })
  const insight = await Insight.create({
    screeningId: screening._id, childId: child._id, generatedBy: 'cl1', status: 'generated', model: 'm', promptVersion: 'p',
    summary: 'CLINICAL-ONLY-SUMMARY', caregiverSummary: 'family words', flaggedAreas: [], uncertainty: 'u', clinicalReviewRequired: true,
  })
  const log = await BehaviourLog.create({
    childId: child._id, loggedBy: 'cg1', loggedByRole: 'caregiver', occurredAt: new Date(),
    antecedent: { category: 'transition' }, behaviour: { category: 'meltdown_tantrum' }, consequence: { category: 'comforted' },
    intensity: 3, local: localFacets(new Date(), 0),
  })
  w = { child: String(child._id), screening: String(screening._id), insight: String(insight._id), log: String(log._id) }
})

describe('authentication', () => {
  const routes = [
    ['get', '/api/auth/me'], ['get', '/api/children'], ['get', '/api/me/caseload'], ['get', '/api/me/notifications'],
    ['get', '/api/screenings/instrument'], ['get', '/api/admin/users'], ['get', '/api/admin/analytics'],
    ['post', '/api/assistant/ask'], ['post', '/api/insights/generate'], ['post', '/api/reports/export'],
  ]
  const headers = [undefined, '', 'Bearer', 'Bearer ', 'Basic Zm9vOmJhcg==', 'bearer cg1|cg1@demo.test', 'Bearer invalid|x', 'Bearer expired|x', 'Token cg1|a']

  it.each(routes)('%s %s refuses every missing / malformed credential with 401', async (method, path) => {
    for (const h of headers) {
      const r = request(app)[method](path)
      if (h !== undefined) r.set('Authorization', h)
      const res = await r.send(method === 'post' ? {} : undefined)
      expect(res.status).toBe(401)
    }
  })

  it('a valid token for a user with no profile gets 404, never data', async () => {
    const res = await http.get('/api/children', 'ghost')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND')
  })
})

describe('sign-up cannot be used to escalate or impersonate', () => {
  const post = (body, uid = 'newbie') => request(app).post('/api/auth/signup').set('Authorization', bearer(uid)).send(body)
  const care = { childName: 'Kid', childDob: '2024-06-01' }

  it('refuses admin, unknown and operator roles', async () => {
    for (const role of ['admin', 'root', '', null, { $ne: null }, ['caregiver']]) {
      expect((await post({ name: 'X', role, roleDetails: care })).status).toBe(400)
    }
    expect(await User.countDocuments({ uid: 'newbie' })).toBe(0)
  })

  it('ignores uid / verified / role-like extras in the body', async () => {
    const res = await post({ name: 'X', role: 'clinician', verified: true, uid: 'cl1', verificationStatus: 'approved',
      roleDetails: { orgName: 'O', licenseNumber: 'L', verified: true } })
    expect(res.status).toBe(201)
    const u = await User.findOne({ uid: 'newbie' }).lean()
    expect(u.verified).toBe(false)
    expect(u.uid).toBe('newbie')
    expect(await User.countDocuments({ uid: 'cl1' })).toBe(1)
    expect((await http.get(`/api/children/${w.child}`, 'newbie')).status).toBe(403) // unverified clinician
  })

  it('rejects object-valued fields (NoSQL operators) in names and details', async () => {
    expect((await post({ name: { $gt: '' }, role: 'caregiver', roleDetails: care })).status).toBe(400)
    expect((await post({ name: 'X', role: 'caregiver', roleDetails: { childName: { $ne: 1 }, childDob: '2024-06-01' } })).status).toBe(400)
  })
})

describe('injection and prototype pollution', () => {
  it('query-string operators are rejected, not executed', async () => {
    const r1 = await request(app).get(`/api/screenings?childId[$ne]=x`).set('Authorization', bearer('cg1'))
    expect(r1.status).toBe(400)
    const r2 = await request(app).get('/api/admin/users?role[$ne]=admin').set('Authorization', bearer('adm'))
    expect(r2.status).toBe(400)
    const r3 = await request(app).get('/api/admin/users?verified[$ne]=1').set('Authorization', bearer('adm'))
    expect(r3.status).toBe(400)
    const r4 = await request(app).get(`/api/children/${w.child}/behaviour-logs?category[$ne]=x`).set('Authorization', bearer('cg1'))
    expect(r4.status).toBe(400)
    const r5 = await request(app).get(`/api/children/${w.child}/behaviour-logs?from[$gt]=1`).set('Authorization', bearer('cg1'))
    expect(r5.status).toBe(400)
  })

  it('body operators are rejected on every id / text field', async () => {
    expect((await http.post('/api/screenings', 'cg1').send({ childId: { $ne: null }, answers })).status).toBe(400)
    expect((await http.post('/api/insights/generate', 'cl1').send({ screeningId: { $ne: null } })).status).toBe(400)
    expect((await http.post('/api/reports/export', 'cg1').send({ screeningId: { $ne: null }, format: 'pdf' })).status).toBe(400)
    expect((await http.post(`/api/children/${w.child}/care-team`, 'cg1').send({ email: { $ne: null } })).status).toBe(400)
    expect((await http.patch('/api/admin/users/cl2/verify', 'adm').send({ verified: { $ne: 1 } })).status).toBe(400)
    expect((await http.post('/api/assistant/ask', 'cg1').send({ question: 'hi', childId: { $ne: null } })).status).toBe(400)
  })

  it('__proto__ / constructor keys do not pollute Object.prototype or change behaviour', async () => {
    const evil = JSON.parse('{"__proto__":{"polluted":"yes","role":"admin"},"constructor":{"prototype":{"polluted":"yes"}}}')
    await http.patch(`/api/children/${w.child}`, 'cg1').send({ name: 'Renamed', ...evil })
    await http.put(`/api/children/${w.child}/milestones`, 'cg1').send({ statuses: JSON.parse('{"language":"reviewed","__proto__":"in_progress"}') })
    await http.post('/api/auth/signup', 'p1').send(evil)
    await http.post('/api/screenings', 'cg1').send({ childId: w.child, answers: JSON.parse(`{"__proto__":"yes","1":"yes"}`) })
    expect({}.polluted).toBeUndefined()
    expect({}.role).toBeUndefined()
    expect((await http.get('/api/admin/users', 'cg1')).status).toBe(403)
  })

  it('screening answers: duplicate / odd keys cannot sneak extra items in or skip the 20 required', async () => {
    const odd = { ...answers, '1.0': 'no', '0x2': 'no' }
    const res = await http.post('/api/screenings', 'cg1').send({ childId: w.child, answers: odd })
    expect(res.status).toBe(400)
    const missing = { ...answers }; delete missing['7']
    expect((await http.post('/api/screenings', 'cg1').send({ childId: w.child, answers: missing })).status).toBe(400)
  })
})

describe('mass assignment', () => {
  it('a caregiver cannot reassign a child, rewrite the care team or set internal fields', async () => {
    const res = await http.patch(`/api/children/${w.child}`, 'cg1').send({
      name: 'Renamed', caregiverUid: 'cg2', careTeam: [{ uid: 'cl2', role: 'clinician' }], _id: '000000000000000000000000', fromSignupProfile: true,
    })
    expect(res.status).toBe(200)
    const c = await Child.findById(w.child).lean()
    expect(c.caregiverUid).toBe('cg1')
    expect(c.careTeam.map((m) => m.uid).sort()).toEqual(['cl1', 'th1'])
    expect(String(c._id)).toBe(w.child)
    expect(c.name).toBe('Renamed')
  })

  it('a behaviour-log edit cannot change its author, child or role', async () => {
    const res = await http.patch(`/api/children/${w.child}/behaviour-logs/${w.log}`, 'cg1').send({
      intensity: 4, loggedBy: 'cg2', loggedByRole: 'clinician', childId: '000000000000000000000000',
    })
    expect(res.status).toBe(200)
    const l = await BehaviourLog.findById(w.log).lean()
    expect(l.loggedBy).toBe('cg1'); expect(l.loggedByRole).toBe('caregiver'); expect(String(l.childId)).toBe(w.child)
  })

  it('a submitted screening ignores client-supplied scores, tier, status and age', async () => {
    await Screening.deleteMany({})
    await Child.updateOne({ _id: w.child }, { dob: new Date(Date.UTC(new Date().getUTCFullYear() - 2, new Date().getUTCMonth(), 1)) })
    aiClient.screen.mockResolvedValue({ riskScore: 20, riskTier: 'high', atRiskItems: [1], domainBreakdown: [] })
    const res = await http.post('/api/screenings', 'cg1').send({
      childId: w.child, answers, riskTier: 'low', riskScore: 0, status: 'REVIEWED', childAgeMonths: 20, clinicianReview: { reviewedAt: new Date() },
    })
    expect(res.status).toBe(201)
    const s = await Screening.findById(res.body.data.screening.id).lean()
    expect(s.status).toBe('INSIGHTS_READY')
    expect(s.riskTier).toBe('high')
    expect(s.childAgeMonths).toBeGreaterThanOrEqual(22)
    expect(s.clinicianReview?.reviewedAt).toBeFalsy()
  })
})

describe('access control (IDOR)', () => {
  const intruder = 'cg2'
  it('another caregiver gets 404 on every per-child and per-screening route', async () => {
    const calls = [
      ['get', `/api/children/${w.child}`], ['get', `/api/children/${w.child}/overview`], ['get', `/api/children/${w.child}/timeline`],
      ['get', `/api/children/${w.child}/behaviour-logs`], ['get', `/api/children/${w.child}/behaviour-summary`],
      ['get', `/api/children/${w.child}/milestones`], ['get', `/api/children/${w.child}/care-team`],
      ['get', `/api/screenings/${w.screening}`], ['get', `/api/screenings?childId=${w.child}`],
      ['get', `/api/insights?screeningId=${w.screening}`], ['get', `/api/reports?childId=${w.child}`],
    ]
    for (const [m, p] of calls) expect([m, p, (await http[m](p, intruder)).status]).toEqual([m, p, 404])
    for (const [m, p, body] of [
      ['post', `/api/children/${w.child}/behaviour-logs`, {}], ['patch', `/api/children/${w.child}`, { name: 'x' }],
      ['patch', `/api/children/${w.child}/behaviour-logs/${w.log}`, { intensity: 1 }], ['delete', `/api/children/${w.child}/behaviour-logs/${w.log}`],
      ['post', `/api/children/${w.child}/care-team`, { email: 'cl2@demo.test' }], ['put', `/api/children/${w.child}/milestones`, { statuses: {} }],
      ['post', '/api/screenings', { childId: w.child, answers }], ['post', `/api/screenings/${w.screening}/retry`],
      ['post', '/api/reports/export', { screeningId: w.screening, format: 'csv' }],
    ]) {
      const res = await http[m](p, intruder).send(body)
      expect([m, p, res.status]).toEqual([m, p, 404])
    }
    expect(await BehaviourLog.countDocuments({ childId: w.child })).toBe(1)
  })

  it('Ask Autara will not attach another family\'s child as context', async () => {
    const res = await http.post('/api/assistant/ask', intruder).send({ question: 'hello', childId: w.child })
    expect(res.status).toBe(404)
    expect(aiClient.ask).not.toHaveBeenCalled()
  })

  it('a clinician who is not on the care team gets 404 everywhere, including approve', async () => {
    for (const [m, p, body] of [
      ['get', `/api/children/${w.child}`], ['get', `/api/screenings/${w.screening}`],
      ['post', `/api/screenings/${w.screening}/open`], ['post', `/api/screenings/${w.screening}/annotations`, { text: 'x' }],
      ['post', `/api/screenings/${w.screening}/override`, { riskTier: 'high', reason: 'because' }], ['post', `/api/screenings/${w.screening}/review`],
      ['post', '/api/insights/generate', { screeningId: w.screening }], ['post', `/api/insights/${w.insight}/approve`],
      ['get', `/api/children/${w.child}/session-notes`], ['post', '/api/reports/export', { screeningId: w.screening, format: 'pdf' }],
    ]) {
      const res = await http[m](p, 'cl2').send(body)
      expect([m, p, res.status]).toEqual([m, p, 404])
    }
    expect((await Insight.findById(w.insight)).status).toBe('generated')
  })

  it('admins cannot reach individual children or screenings', async () => {
    expect((await http.get(`/api/children/${w.child}`, 'adm')).status).toBe(403)
    expect((await http.get('/api/children', 'adm')).status).toBe(403)
    expect((await http.get(`/api/screenings/${w.screening}`, 'adm')).status).toBe(403)
  })

  it('role matrix: wrong roles never get a 2xx on privileged routes', async () => {
    const privileged = [
      ['cg1', 'get', '/api/admin/users'], ['cl1', 'get', '/api/admin/analytics'], ['th1', 'patch', '/api/admin/users/cl2/verify', { verified: true }],
      ['cg1', 'post', '/api/insights/generate', { screeningId: w.screening }], ['th1', 'post', `/api/insights/${w.insight}/approve`],
      ['cg1', 'post', `/api/insights/${w.insight}/approve`], ['th1', 'post', `/api/screenings/${w.screening}/review`],
      ['cg1', 'post', `/api/screenings/${w.screening}/override`, { riskTier: 'low', reason: 'let me' }],
      ['cl1', 'post', '/api/screenings', { childId: w.child, answers }], ['th1', 'post', '/api/assistant/ask', { question: 'hi' }],
      ['th1', 'post', '/api/reports/export', { screeningId: w.screening, format: 'csv' }],
      ['cg1', 'get', `/api/children/${w.child}/session-notes`], ['cg1', 'post', `/api/children/${w.child}/session-notes`, { text: 'x' }],
      ['cl1', 'post', `/api/children/${w.child}/session-notes`, { text: 'x' }], ['cl1', 'patch', `/api/children/${w.child}`, { name: 'x' }],
      ['th1', 'post', `/api/children/${w.child}/care-team`, { email: 'cl2@demo.test' }], ['cg1', 'get', '/api/me/review-queue'], ['cg1', 'get', '/api/me/caseload'],
    ]
    for (const [uid, m, p, body] of privileged) {
      const res = await http[m](p, uid).send(body)
      expect([uid, m, p, res.status >= 400 && res.status < 500]).toEqual([uid, m, p, true])
    }
  })
})

describe('AI insight gate', () => {
  it('caregivers and the unapproved list never see a generated (unapproved) insight', async () => {
    const res = await http.get(`/api/insights?screeningId=${w.screening}`, 'cg1')
    expect(res.status).toBe(200)
    expect(res.body.data.insights).toEqual([])
    expect((await http.get(`/api/insights?screeningId=${w.screening}`, 'th1')).body.data.insights).toEqual([])
    expect(JSON.stringify((await http.get(`/api/children/${w.child}/timeline`, 'cg1')).body)).not.toMatch(/CLINICAL-ONLY|family words/)
    expect(JSON.stringify((await http.get(`/api/children/${w.child}/overview`, 'cg1')).body)).not.toMatch(/CLINICAL-ONLY|family words/)
  })

  it('after approval the caregiver sees only the plain summary, never the clinical text or model details', async () => {
    expect((await http.post(`/api/insights/${w.insight}/approve`, 'cl1')).status).toBe(200)
    const res = await http.get(`/api/insights?screeningId=${w.screening}`, 'cg1')
    const body = JSON.stringify(res.body)
    expect(body).toMatch(/family words/)
    expect(body).not.toMatch(/CLINICAL-ONLY|promptVersion|retrievedChunkIds|failureReasons|generatedBy|approvedBy/)
  })

  it('a failed insight can never be approved', async () => {
    await Insight.updateOne({ _id: w.insight }, { status: 'failed' })
    expect((await http.post(`/api/insights/${w.insight}/approve`, 'cl1')).status).toBe(409)
  })

  it('a caregiver cannot export a report before the clinician has reviewed', async () => {
    expect((await http.post('/api/reports/export', 'cg1').send({ screeningId: w.screening, format: 'pdf' })).status).toBe(403)
  })
})

describe('review lock and audit trail', () => {
  it('a REVIEWED screening is locked against every clinician write', async () => {
    expect((await http.post(`/api/screenings/${w.screening}/review`, 'cl1')).status).toBe(200)
    for (const [p, body] of [
      ['annotations', { text: 'late note' }], ['override', { riskTier: 'high', reason: 'changed my mind' }], ['review'],
    ]) {
      expect([p, (await http.post(`/api/screenings/${w.screening}/${p}`, 'cl1').send(body)).status]).toEqual([p, 409])
    }
    expect((await http.post('/api/insights/generate', 'cl1').send({ screeningId: w.screening })).status).toBe(409)
  })

  it('a caregiver cannot retry a healthy screening or jump its status', async () => {
    expect((await http.post(`/api/screenings/${w.screening}/retry`, 'cg1')).status).toBe(409)
  })
})

describe('input hardening and information leaks', () => {
  it('oversized JSON is refused cleanly', async () => {
    const res = await http.post('/api/assistant/ask', 'cg1').send({ question: 'x'.repeat(200_000) })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BODY_TOO_LARGE')
  })

  it('malformed JSON and wrong content types do not leak internals', async () => {
    const bad = await request(app).post('/api/assistant/ask').set('Authorization', bearer('cg1')).set('Content-Type', 'application/json').send('{"question": ')
    expect(bad.status).toBe(400)
    expect(JSON.stringify(bad.body)).not.toMatch(/at \w+|node_modules|SyntaxError|stack/i)
    const wrongType = await request(app).post('/api/assistant/ask').set('Authorization', bearer('cg1')).set('Content-Type', 'text/plain').send('question=hi')
    expect(wrongType.status).toBe(400)
    const arrayBody = await http.post('/api/children', 'cg1').send([1, 2, 3])
    expect(arrayBody.status).toBe(400)
  })

  it('unknown routes and path tricks return the standard 404 and no framework fingerprint', async () => {
    for (const p of ['/api/nope', '/api/../etc/passwd', '/api/children/%2e%2e/admin/users', '/.env', '/api/children/;ls']) {
      const res = await request(app).get(p).set('Authorization', bearer('adm'))
      expect([401, 403, 404]).toContain(res.status)
      expect(res.text).not.toMatch(/Cannot GET|<pre>|node_modules/)
    }
    const res = await request(app).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
  })

  it('CORS only allows listed origins and never reflects a wildcard with credentials', async () => {
    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example')
    expect(evil.headers['access-control-allow-origin']).toBeUndefined()
    const good = await request(app).get('/api/health').set('Origin', 'http://localhost:3000')
    expect(good.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    const pre = await request(app).options('/api/children').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET')
    expect(pre.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('the public AI health probe reveals no secrets', async () => {
    aiClient.health.mockResolvedValue({ status: 'ok', service: 'autara-ai-service' })
    const res = await request(app).get('/api/health/ai')
    expect(JSON.stringify(res.body)).not.toMatch(/key|secret|token|mongodb|AIza/i)
    aiClient.health.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000 key=abc'), { status: 503, code: 'AI_SERVICE_UNAVAILABLE' }))
    const down = await request(app).get('/api/health/ai')
    expect(down.status).toBeGreaterThanOrEqual(500)
    expect(JSON.stringify(down.body)).not.toMatch(/127\.0\.0\.1|ECONNREFUSED|key=abc/)
  })

  it('enumeration: unknown, unverified and non-professional emails look identical when adding to the care team', async () => {
    await makeUser('cl3', 'clinician') // unverified
    const a = await http.post(`/api/children/${w.child}/care-team`, 'cg1').send({ email: 'nobody@demo.test' })
    const b = await http.post(`/api/children/${w.child}/care-team`, 'cg1').send({ email: 'cl3@demo.test' })
    const c = await http.post(`/api/children/${w.child}/care-team`, 'cg1').send({ email: 'cg2@demo.test' })
    expect([a.status, b.status, c.status]).toEqual([404, 404, 404])
    expect(a.body).toEqual(b.body); expect(b.body).toEqual(c.body)
  })
})

describe('privacy of data sent to the language model', () => {
  it('removes the child\'s name from notes even for accented / non-Latin names and mid-sentence use', () => {
    expect(scrub('Ānya cried at the gate', ['Ānya'])).toBe('[child] cried at the gate')
    expect(scrub('José was upset; josé hit the table', ['José'])).toBe('[child] was upset; [child] hit the table')
    expect(scrub('आरव ने रोना शुरू किया', ['आरव'])).toBe('[child] ने रोना शुरू किया')
    expect(scrub("Aarav's sister said Aarav slept", ['Aarav'])).toBe("[child]'s sister said [child] slept")
    expect(scrub('Aaravi is another person', ['Aarav'])).toBe('Aaravi is another person')
  })
})
