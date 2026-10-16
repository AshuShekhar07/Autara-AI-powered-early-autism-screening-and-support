const app = require('../app')
const Child = require('../models/Child')
const { getAccessibleChild } = require('../middleware/childAccess')
const AuditLog = require('../models/AuditLog')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

async function world() {
  await makeUser('cg1', 'caregiver')
  await makeUser('cg2', 'caregiver')
  await makeUser('th1', 'therapist', { verified: true })
  await makeUser('cl-ok', 'clinician', { verified: true })
  await makeUser('cl-pending', 'clinician') // unverified
  await makeUser('adm', 'admin')
  const child = await makeChild('cg1', {
    careTeam: [{ uid: 'th1', role: 'therapist' }, { uid: 'cl-ok', role: 'clinician' }, { uid: 'cl-pending', role: 'clinician' }],
  })
  return { child, id: String(child._id) }
}

describe('child access control', () => {
  it('owner can read their child', async () => {
    const { id } = await world()
    const res = await http.get(`/api/children/${id}`, 'cg1')
    expect(res.status).toBe(200)
    expect(res.body.data.child.relation).toBe('owner')
  })

  it("a caregiver cannot read another caregiver's child (404, no leak)", async () => {
    const { id } = await world()
    const other = await http.get(`/api/children/${id}`, 'cg2')
    const missing = await http.get('/api/children/000000000000000000000000', 'cg2')
    expect(other.status).toBe(404)
    expect(other.body).toEqual(missing.body) // indistinguishable from "does not exist"
    expect(other.body.error.code).toBe('CHILD_NOT_FOUND')
  })

  it('verified care-team professionals can read; non-members cannot', async () => {
    const { id } = await world()
    await makeUser('th2', 'therapist', { verified: true })
    expect((await http.get(`/api/children/${id}`, 'th1')).status).toBe(200)
    expect((await http.get(`/api/children/${id}`, 'cl-ok')).status).toBe(200)
    expect((await http.get(`/api/children/${id}`, 'th2')).status).toBe(404)
  })

  it('an unverified clinician gets 403 ACCOUNT_NOT_VERIFIED even when on the care team', async () => {
    const { id } = await world()
    const res = await http.get(`/api/children/${id}`, 'cl-pending')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED')
    expect((await http.get('/api/me/caseload', 'cl-pending')).status).toBe(403)
  })

  it('admin cannot read an individual child', async () => {
    const { id } = await world()
    const res = await http.get(`/api/children/${id}`, 'adm')
    expect(res.status).toBe(403)
    // and the helper itself refuses admins even if a route forgot the role guard
    await expect(getAccessibleChild({ uid: 'adm', role: 'admin' }, id)).rejects.toMatchObject({ status: 403, code: 'ADMIN_NO_CHILD_ACCESS' })
  })

  it('malformed ids are a 404, not a 500', async () => {
    await world()
    const res = await http.get('/api/children/not-an-id', 'cg1')
    expect(res.status).toBe(404)
  })

  it('professionals cannot edit the child or the care team', async () => {
    const { id } = await world()
    expect((await http.patch(`/api/children/${id}`, 'th1').send({ name: 'X' })).status).toBe(403)
    expect((await http.delete(`/api/children/${id}/care-team/th1`, 'th1')).status).toBe(403)
  })
})

describe('children CRUD + migration', () => {
  it('GET /api/children migrates the signup profile child exactly once', async () => {
    await makeUser('cg1', 'caregiver') // roleDetails: Demo Child
    const a = await http.get('/api/children', 'cg1')
    const b = await http.get('/api/children', 'cg1')
    expect(a.body.data.children).toHaveLength(1)
    expect(b.body.data.children).toHaveLength(1)
    expect(a.body.data.children[0].name).toBe('Demo Child')
    expect(await Child.countDocuments({ caregiverUid: 'cg1' })).toBe(1)
  })

  it('a caregiver can add and edit several children', async () => {
    await makeUser('cg1', 'caregiver')
    await http.get('/api/children', 'cg1')
    const created = await http.post('/api/children', 'cg1').send({ name: 'Second', dob: '2023-01-10', sex: 'female' })
    expect(created.status).toBe(201)
    const patched = await http.patch(`/api/children/${created.body.data.child.id}`, 'cg1').send({ name: 'Renamed' })
    expect(patched.body.data.child.name).toBe('Renamed')
    expect((await http.get('/api/children', 'cg1')).body.data.children).toHaveLength(2)
  })

  it('validates dob', async () => {
    await makeUser('cg1', 'caregiver')
    const res = await http.post('/api/children', 'cg1').send({ name: 'X', dob: '2999-01-01' })
    expect(res.status).toBe(400)
  })

  it('therapists cannot create children', async () => {
    await makeUser('th1', 'therapist', { verified: true })
    expect((await http.post('/api/children', 'th1').send({ name: 'X', dob: '2023-01-10' })).status).toBe(403)
  })
})

describe('care team', () => {
  it('adds a verified professional by email (audited) and rejects duplicates', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
    const child = await makeChild('cg1')
    const id = String(child._id)

    const res = await http.post(`/api/children/${id}/care-team`, 'cg1').send({ email: 'TH1@demo.test' })
    expect(res.status).toBe(201)
    expect(res.body.data.careTeam[0]).toMatchObject({ uid: 'th1', role: 'therapist' })
    expect(await AuditLog.countDocuments({ action: 'CARE_TEAM_ADDED' })).toBe(1)

    const dup = await http.post(`/api/children/${id}/care-team`, 'cg1').send({ email: 'th1@demo.test' })
    expect(dup.status).toBe(409)
  })

  it('404 PROFESSIONAL_NOT_FOUND for unknown, unverified, or non-professional emails', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('cg9', 'caregiver')
    await makeUser('cl-pending', 'clinician')
    const id = String((await makeChild('cg1'))._id)
    for (const email of ['nobody@demo.test', 'cl-pending@demo.test', 'cg9@demo.test']) {
      const res = await http.post(`/api/children/${id}/care-team`, 'cg1').send({ email })
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('PROFESSIONAL_NOT_FOUND')
    }
  })

  it('removes a member (audited)', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
    const child = await makeChild('cg1', { careTeam: [{ uid: 'th1', role: 'therapist' }] })
    const res = await http.delete(`/api/children/${child._id}/care-team/th1`, 'cg1')
    expect(res.status).toBe(200)
    expect(res.body.data.careTeam).toHaveLength(0)
    expect(await AuditLog.countDocuments({ action: 'CARE_TEAM_REMOVED' })).toBe(1)
    expect((await http.get(`/api/children/${child._id}`, 'th1')).status).toBe(404) // access gone
  })

  it('caseload lists only assigned children', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
    await makeChild('cg1', { name: 'Mine', careTeam: [{ uid: 'th1', role: 'therapist' }] })
    await makeChild('cg1', { name: 'Not mine' })
    const res = await http.get('/api/me/caseload', 'th1')
    expect(res.body.data.children.map((c) => c.name)).toEqual(['Mine'])
  })
})
