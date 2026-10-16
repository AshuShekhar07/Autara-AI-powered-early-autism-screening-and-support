const app = require('../app')
const User = require('../models/User')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(async () => { await clearDb(); global.__verifyCalls.length = 0; delete process.env.AUTH_CHECK_REVOKED })
afterAll(() => { delete process.env.AUTH_CHECK_REVOKED })

describe('auth edge cases', () => {
  it('an expired token gets a clear 401 asking the user to sign in again', async () => {
    const res = await http.get('/api/auth/me', 'expired')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_INVALID_TOKEN')
    expect(res.body.error.message).toMatch(/session has expired/i)
  })

  it('by default the revocation check is off (no extra Firebase lookup)', async () => {
    await makeUser('u1', 'caregiver')
    await http.get('/api/auth/me', 'u1')
    expect(global.__verifyCalls.at(-1).checkRevoked).toBe(false)
  })

  it('with AUTH_CHECK_REVOKED=true a revoked session is rejected', async () => {
    process.env.AUTH_CHECK_REVOKED = 'true'
    await makeUser('revoked', 'caregiver')
    const res = await http.get('/api/auth/me', 'revoked')
    expect(res.status).toBe(401)
    expect(res.body.error.message).toMatch(/no longer valid/i)
    expect(global.__verifyCalls.at(-1).checkRevoked).toBe(true)
  })

  it('with AUTH_CHECK_REVOKED=true a disabled/deleted account is rejected even if a profile exists in MongoDB', async () => {
    process.env.AUTH_CHECK_REVOKED = 'true'
    await makeUser('disabled', 'clinician')
    expect(await User.countDocuments({ uid: 'disabled' })).toBe(1)
    const res = await http.get('/api/auth/me', 'disabled')
    expect(res.status).toBe(401)
    expect(res.body.error.message).toMatch(/disabled/i)
  })

  it('a valid Firebase user without a MongoDB profile gets PROFILE_NOT_FOUND, not a crash', async () => {
    const res = await http.get('/api/auth/me', 'ghost')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND')
  })

  it('a token that is not a Bearer header is AUTH_REQUIRED', async () => {
    const res = await require('supertest')(app).get('/api/auth/me').set('Authorization', 'Basic abc')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_REQUIRED')
  })
})
