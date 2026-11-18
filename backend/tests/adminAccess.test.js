const request = require('supertest')
const app = require('../app')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser } = require('./helpers')

// tests/env.js sets ADMIN_EMAILS = 'adm@demo.test, Boss@Demo.test'
const http = api(app)
const access = (uid, email, flag) =>
  request(app).post('/api/auth/admin-access').set('Authorization', `Bearer ${uid}|${email}${flag ? `|${flag}` : ''}`)

beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

describe('hidden admin login (/api/auth/admin-access)', () => {
  it('an email that is not on the list is told it is not an admin, and nothing is created', async () => {
    const res = await access('rand', 'someone@demo.test').send({ name: 'Random' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_ADMIN')
    expect(res.body.error.message).toMatch(/not an admin/i)
    expect(await User.countDocuments()).toBe(0)
    expect(await AuditLog.countDocuments({ action: 'ADMIN_ACCESS_DENIED' })).toBe(1)
  })

  it('a parent or clinician account cannot get in through the admin page', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('cl1', 'clinician', { verified: true })
    expect((await access('cg1', 'cg1@demo.test').send({})).body.error.code).toBe('NOT_ADMIN')
    expect((await access('cl1', 'cl1@demo.test').send({})).body.error.code).toBe('NOT_ADMIN')
    expect((await User.findOne({ uid: 'cg1' })).role).toBe('caregiver')
  })

  it('a listed email must be confirmed first', async () => {
    const res = await access('a1', 'adm@demo.test', 'unverified').send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED')
    expect(await User.countDocuments()).toBe(0)
  })

  it('first visit of a listed, confirmed email creates the admin account (sign-up); later visits log in', async () => {
    const first = await access('a1', 'adm@demo.test').send({ name: 'First Admin' })
    expect(first.status).toBe(200)
    expect(first.body.data).toMatchObject({ role: 'admin', verified: true, name: 'First Admin' })
    const again = await access('a1', 'adm@demo.test').send({})
    expect(again.status).toBe(200)
    expect(await User.countDocuments({ role: 'admin' })).toBe(1)
    expect(await AuditLog.countDocuments({ action: 'ADMIN_CREATED' })).toBe(1)
    expect((await http.get('/api/admin/users', 'a1', 'adm@demo.test')).status).toBe(200)
  })

  it('email matching ignores capitals and spaces in the list', async () => {
    expect((await access('b1', 'boss@demo.test').send({})).status).toBe(200)
  })

  it('an existing account on a listed email is switched to admin (audited)', async () => {
    await User.create({ uid: 'b2', name: 'Boss', email: 'boss@demo.test', role: 'caregiver', roleDetails: { childName: 'X', childDob: '2024-01-01' } })
    const res = await access('b2', 'boss@demo.test').send({})
    expect(res.status).toBe(200)
    expect((await User.findOne({ uid: 'b2' })).role).toBe('admin')
    expect(await AuditLog.findOne({ action: 'ADMIN_PROMOTED' })).toMatchObject({ meta: { previousRole: 'caregiver' } })
  })

  it('normal sign-up still cannot create an admin', async () => {
    const res = await http.post('/api/auth/signup', 'x1', 'adm@demo.test').send({ name: 'Sneaky', role: 'admin' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_ROLE')
  })

  it('an admin in the database whose email is NOT on the list is locked out of every admin route', async () => {
    await makeUser('old', 'admin')            // old@demo.test — not on ADMIN_EMAILS
    const res = await http.get('/api/admin/users', 'old')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_ADMIN')
    expect((await http.patch('/api/admin/users/x/verify', 'old').send({ verified: true })).status).toBe(403)
  })

  it('with ADMIN_EMAILS empty nobody is an admin', async () => {
    const saved = process.env.ADMIN_EMAILS
    process.env.ADMIN_EMAILS = ''
    try {
      expect((await access('a1', 'adm@demo.test').send({})).body.error.code).toBe('NOT_ADMIN')
    } finally { process.env.ADMIN_EMAILS = saved }
  })
})
