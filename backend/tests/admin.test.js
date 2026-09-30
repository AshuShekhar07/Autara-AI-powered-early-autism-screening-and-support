const app = require('../app')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

describe('admin verification', () => {
  beforeEach(async () => {
    await makeUser('adm', 'admin')
    await makeUser('cl1', 'clinician')
    await makeUser('th1', 'therapist', { verified: true })
    await makeUser('cg1', 'caregiver')
  })

  it('non-admins are refused', async () => {
    expect((await http.get('/api/admin/users', 'cg1')).status).toBe(403)
    expect((await http.patch('/api/admin/users/cl1/verify', 'th1').send({ verified: true })).status).toBe(403)
  })

  it('lists users with filters and exposes org/licence but not child details', async () => {
    const res = await http.get('/api/admin/users?role=clinician&verified=false', 'adm')
    expect(res.status).toBe(200)
    expect(res.body.data.users).toHaveLength(1)
    expect(res.body.data.users[0]).toMatchObject({ uid: 'cl1', orgName: expect.any(String), licenseNumber: expect.any(String) })
    const all = await http.get('/api/admin/users', 'adm')
    const cg = all.body.data.users.find((u) => u.uid === 'cg1')
    expect(JSON.stringify(cg)).not.toMatch(/childName|childDob|Demo Child/)
  })

  it('rejects bad filters', async () => {
    expect((await http.get('/api/admin/users?verified=maybe', 'adm')).status).toBe(400)
    expect((await http.get('/api/admin/users?role[$ne]=x', 'adm')).status).toBe(400)
  })

  it('verifies and un-verifies a clinician, writing audit rows', async () => {
    let res = await http.patch('/api/admin/users/cl1/verify', 'adm').send({ verified: true })
    expect(res.status).toBe(200)
    expect((await User.findOne({ uid: 'cl1' })).verified).toBe(true)
    res = await http.patch('/api/admin/users/cl1/verify', 'adm').send({ verified: false })
    expect((await User.findOne({ uid: 'cl1' })).verified).toBe(false)
    const actions = (await AuditLog.find({ targetId: 'cl1' })).map((a) => a.action).sort()
    expect(actions).toEqual(['USER_VERIFICATION_REVOKED', 'USER_VERIFIED'])
  })

  it('only clinical accounts can be verified; validates input', async () => {
    expect((await http.patch('/api/admin/users/cg1/verify', 'adm').send({ verified: true })).body.error.code).toBe('NOT_A_CLINICAL_ACCOUNT')
    expect((await http.patch('/api/admin/users/cl1/verify', 'adm').send({ verified: 'yes' })).status).toBe(400)
    expect((await http.patch('/api/admin/users/nobody/verify', 'adm').send({ verified: true })).status).toBe(404)
  })
})
