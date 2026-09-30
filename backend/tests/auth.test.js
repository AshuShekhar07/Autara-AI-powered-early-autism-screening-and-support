const app = require('../app')
const User = require('../models/User')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

const caregiverBody = {
  name: 'Casey Caregiver', role: 'caregiver',
  roleDetails: { childName: 'Alex', childDob: '2024-08-01' },
}

describe('response envelope', () => {
  it('health returns success envelope', async () => {
    const res = await http.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } })
  })

  it('unknown route returns error envelope', async () => {
    const res = await http.get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, error: { code: 'ROUTE_NOT_FOUND', message: expect.any(String) } })
  })

  it('malformed JSON is a 400 INVALID_JSON', async () => {
    const res = await http.post('/api/auth/signup', 'u1').set('Content-Type', 'application/json').send('{bad')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_JSON')
  })
})

describe('POST /api/auth/signup', () => {
  it('requires a Firebase token', async () => {
    const res = await http.post('/api/auth/signup').send(caregiverBody)
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('AUTH_REQUIRED')
  })

  it('rejects an invalid token', async () => {
    const res = await http.post('/api/auth/signup', 'invalid').send(caregiverBody)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('takes uid and email from the token, ignoring the body (spoofing fix)', async () => {
    const res = await http.post('/api/auth/signup', 'real-uid', 'real@demo.test')
      .send({ ...caregiverBody, uid: 'victim-uid', email: 'victim@demo.test' })
    expect(res.status).toBe(201)
    expect(res.body.data.uid).toBe('real-uid')
    expect(await User.findOne({ uid: 'victim-uid' })).toBeNull()
    const saved = await User.findOne({ uid: 'real-uid' })
    expect(saved.email).toBe('real@demo.test')
  })

  it('cannot overwrite an existing profile for the same uid/email', async () => {
    await http.post('/api/auth/signup', 'u1', 'u1@demo.test').send(caregiverBody)
    const res = await http.post('/api/auth/signup', 'u1', 'u1@demo.test').send({ ...caregiverBody, role: 'patient' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ACCOUNT_EXISTS')
    expect((await User.findOne({ uid: 'u1' })).role).toBe('caregiver')
  })

  it('blocks self-service admin signup', async () => {
    const res = await http.post('/api/auth/signup', 'u2').send({ ...caregiverBody, role: 'admin' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_ROLE')
  })

  it('creates clinical accounts unverified', async () => {
    const res = await http.post('/api/auth/signup', 'c1').send({
      name: 'Dr Demo', role: 'clinician', roleDetails: { orgName: 'Demo Clinic', licenseNumber: 'X-1' },
    })
    expect(res.status).toBe(201)
    expect(res.body.data.verified).toBe(false)
  })

  it('validates role details', async () => {
    const res = await http.post('/api/auth/signup', 'u3').send({ name: 'X', role: 'caregiver', roleDetails: {} })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects object-valued fields (NoSQL injection guard)', async () => {
    const res = await http.post('/api/auth/signup', 'u4').send({ ...caregiverBody, name: { $ne: '' } })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  it('returns profile in the envelope', async () => {
    await makeUser('cg1', 'caregiver')
    const res = await http.get('/api/auth/me', 'cg1')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ uid: 'cg1', role: 'caregiver', verified: true })
  })

  it('works for an unverified clinician so the UI can show the pending page', async () => {
    await makeUser('cl1', 'clinician')
    const res = await http.get('/api/auth/me', 'cl1')
    expect(res.status).toBe(200)
    expect(res.body.data.verified).toBe(false)
  })

  it('404 PROFILE_NOT_FOUND when signup has not happened', async () => {
    const res = await http.get('/api/auth/me', 'ghost')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND')
  })
})
