const app = require('../app')
const User = require('../models/User')
const Child = require('../models/Child')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const SessionNote = require('../models/SessionNote')
const AuditLog = require('../models/AuditLog')
const { ANTECEDENTS, BEHAVIOURS, CONSEQUENCES } = require('../lib/behaviourEnums')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(async () => { await clearDb(); global.__firebaseCalls = [] })

const SCREENING = (childId, uid) => ({ childId, submittedBy: uid, childAgeMonths: 22, answers: { 1: 'yes' } })

async function seedChildWithData(caregiverUid = 'cg1') {
  const child = await makeChild(caregiverUid, { name: 'Synthetic Kid', careTeam: [{ uid: 'th1', role: 'therapist' }] })
  await Screening.create(SCREENING(child._id, caregiverUid))
  await BehaviourLog.create({
    childId: child._id, loggedBy: caregiverUid, loggedByRole: 'caregiver', occurredAt: new Date(), intensity: 3,
    antecedent: { category: ANTECEDENTS[0] }, behaviour: { category: BEHAVIOURS[0] }, consequence: { category: CONSEQUENCES[0] },
  })
  await SessionNote.create({ childId: child._id, authorUid: 'th1', text: 'Synthetic note' })
  for (const M of [Screening, BehaviourLog, SessionNote]) expect(await M.countDocuments({ childId: child._id })).toBe(1)
  return child
}

describe('delete a child', () => {
  beforeEach(async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('cg2', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
  })

  it('needs the child\'s name typed exactly, then removes the child and every record about them', async () => {
    const child = await seedChildWithData()
    const id = String(child._id)
    expect((await http.delete(`/api/children/${id}`, 'cg1').send({ confirmName: 'wrong' })).body.error.code).toBe('CONFIRMATION_REQUIRED')
    const res = await http.delete(`/api/children/${id}`, 'cg1').send({ confirmName: 'synthetic kid' })
    expect(res.status).toBe(200)
    expect(await Child.countDocuments({ _id: child._id })).toBe(0)
    expect(await SessionNote.countDocuments({ childId: child._id })).toBe(0)
    expect(await BehaviourLog.countDocuments({ childId: child._id })).toBe(0)
    expect(await Screening.countDocuments({ childId: child._id })).toBe(0)
    expect(await AuditLog.countDocuments({ action: 'CHILD_DELETED' })).toBe(1)
  })

  it('the child entered at sign-up does not come back after being deleted', async () => {
    const list = await http.get('/api/children', 'cg1')           // creates "Demo Child" from the sign-up profile
    const kid = list.body.data.children[0]
    expect(kid.name).toBe('Demo Child')
    await http.delete(`/api/children/${kid.id}`, 'cg1').send({ confirmName: 'Demo Child' })
    expect((await http.get('/api/children', 'cg1')).body.data.children).toEqual([])
  })

  it('another caregiver or a care-team therapist cannot delete it', async () => {
    const child = await seedChildWithData()
    expect((await http.delete(`/api/children/${child._id}`, 'cg2').send({ confirmName: 'Synthetic Kid' })).status).toBe(404)
    expect((await http.delete(`/api/children/${child._id}`, 'th1').send({ confirmName: 'Synthetic Kid' })).status).toBe(403)
    expect(await Child.countDocuments()).toBe(1)
  })
})

describe('delete my account', () => {
  it('caregiver: account, children and their records are gone, and the Firebase sign-in is deleted', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
    const child = await seedChildWithData()
    expect((await http.delete('/api/auth/me', 'cg1').send({ confirm: 'yes' })).body.error.code).toBe('CONFIRMATION_REQUIRED')
    const res = await http.delete('/api/auth/me', 'cg1').send({ confirm: 'DELETE' })
    expect(res.status).toBe(200)
    expect(res.body.data.children).toBe(1)
    expect(await User.countDocuments({ uid: 'cg1' })).toBe(0)
    expect(await Child.countDocuments({ _id: child._id })).toBe(0)
    expect(await SessionNote.countDocuments()).toBe(0)
    expect(global.__firebaseCalls).toContainEqual(['deleteUser', 'cg1'])
    expect((await http.get('/api/auth/me', 'cg1')).status).toBe(404)
  })

  it('therapist: removed from every care team, the child and its notes stay', async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
    const child = await seedChildWithData()
    expect((await http.delete('/api/auth/me', 'th1').send({ confirm: 'DELETE' })).status).toBe(200)
    const after = await Child.findById(child._id)
    expect(after.careTeam).toHaveLength(0)
    expect(await SessionNote.countDocuments({ childId: child._id })).toBe(1)
  })

  it('an unverified clinician can delete their account; an admin cannot use this route', async () => {
    await makeUser('cl1', 'clinician')
    expect((await http.delete('/api/auth/me', 'cl1').send({ confirm: 'DELETE' })).status).toBe(200)
    await makeUser('adm', 'admin')
    expect((await http.delete('/api/auth/me', 'adm').send({ confirm: 'DELETE' })).body.error.code).toBe('ADMIN_ACCOUNT')
  })
})

describe('email confirmed flag', () => {
  it('/me reports and stores whether Firebase says the email is confirmed', async () => {
    await makeUser('cg1', 'caregiver')
    const before = await http.get('/api/auth/me', 'cg1', 'cg1@demo.test|unverified')
    expect(before.body.data.emailVerified).toBe(false)
    const after = await http.get('/api/auth/me', 'cg1')
    expect(after.body.data.emailVerified).toBe(true)
    expect((await User.findOne({ uid: 'cg1' })).emailVerified).toBe(true)
  })
})

describe('therapist session notes: edit and delete', () => {
  let child
  beforeEach(async () => {
    await makeUser('cg1', 'caregiver')
    await makeUser('th1', 'therapist', { verified: true })
    await makeUser('th2', 'therapist', { verified: true })
    child = await makeChild('cg1', { careTeam: [{ uid: 'th1', role: 'therapist' }, { uid: 'th2', role: 'therapist' }] })
  })

  it('the author can edit (marked as edited) and delete their own note', async () => {
    const made = await http.post(`/api/children/${child._id}/session-notes`, 'th1').send({ text: 'First version' })
    const id = made.body.data.note.id
    const edited = await http.patch(`/api/children/${child._id}/session-notes/${id}`, 'th1').send({ text: 'Second version' })
    expect(edited.status).toBe(200)
    expect(edited.body.data.note).toMatchObject({ text: 'Second version' })
    expect(edited.body.data.note.editedAt).toBeTruthy()
    expect((await http.delete(`/api/children/${child._id}/session-notes/${id}`, 'th1')).status).toBe(200)
    expect(await SessionNote.countDocuments()).toBe(0)
    expect(await AuditLog.countDocuments({ action: { $in: ['SESSION_NOTE_EDITED', 'SESSION_NOTE_DELETED'] } })).toBe(2)
  })

  it('another therapist cannot change someone else\'s note; bad ids are 404', async () => {
    const made = await http.post(`/api/children/${child._id}/session-notes`, 'th1').send({ text: 'Mine' })
    const id = made.body.data.note.id
    expect((await http.patch(`/api/children/${child._id}/session-notes/${id}`, 'th2').send({ text: 'Hacked' })).status).toBe(403)
    expect((await http.delete(`/api/children/${child._id}/session-notes/${id}`, 'th2')).status).toBe(403)
    expect((await http.delete(`/api/children/${child._id}/session-notes/nope`, 'th1')).status).toBe(404)
    expect((await http.patch(`/api/children/${child._id}/session-notes/${id}`, 'cg1').send({ text: 'x' })).status).toBe(403)
    expect((await SessionNote.findById(id)).text).toBe('Mine')
  })
})

describe('admin: disable users and read the audit log', () => {
  beforeEach(async () => {
    await makeUser('adm', 'admin')
    await makeUser('cg1', 'caregiver')
  })

  it('a disabled user is refused everywhere, also in Firebase; enabling lets them back in', async () => {
    const res = await http.patch('/api/admin/users/cg1/disabled', 'adm').send({ disabled: true })
    expect(res.status).toBe(200)
    expect(res.body.data.user.disabled).toBe(true)
    expect(global.__firebaseCalls).toEqual(expect.arrayContaining([['updateUser', 'cg1', { disabled: true }], ['revokeRefreshTokens', 'cg1']]))
    const me = await http.get('/api/auth/me', 'cg1')
    expect(me.status).toBe(403)
    expect(me.body.error.code).toBe('ACCOUNT_DISABLED')
    expect((await http.get('/api/children', 'cg1')).status).toBe(403)
    await http.patch('/api/admin/users/cg1/disabled', 'adm').send({ disabled: false })
    expect((await http.get('/api/auth/me', 'cg1')).status).toBe(200)
  })

  it('admins cannot be disabled; only admins can disable; bad input is refused', async () => {
    expect((await http.patch('/api/admin/users/adm/disabled', 'adm').send({ disabled: true })).body.error.code).toBe('CANNOT_DISABLE_ADMIN')
    expect((await http.patch('/api/admin/users/adm/disabled', 'cg1').send({ disabled: true })).status).toBe(403)
    expect((await http.patch('/api/admin/users/cg1/disabled', 'adm').send({ disabled: 'yes' })).status).toBe(400)
    expect((await http.patch('/api/admin/users/ghost/disabled', 'adm').send({ disabled: true })).status).toBe(404)
  })

  it('audit log lists actions newest first with actor names, filters by action, and is admin-only', async () => {
    await http.patch('/api/admin/users/cg1/disabled', 'adm').send({ disabled: true })
    await http.patch('/api/admin/users/cg1/disabled', 'adm').send({ disabled: false })
    const res = await http.get('/api/admin/audit', 'adm')
    expect(res.status).toBe(200)
    expect(res.body.data.entries[0]).toMatchObject({ action: 'USER_ENABLED', actorName: 'Demo adm', targetId: 'cg1' })
    expect(res.body.data.actions).toEqual(['USER_DISABLED', 'USER_ENABLED'])
    const only = await http.get('/api/admin/audit?action=USER_DISABLED', 'adm')
    expect(only.body.data.entries.map((e) => e.action)).toEqual(['USER_DISABLED'])
    expect((await http.get('/api/admin/audit?action=$ne', 'adm')).status).toBe(400)
    expect((await http.get('/api/admin/audit', 'cg1')).status).toBe(403)
  })

  it('the user list shows the email-confirmed and disabled flags', async () => {
    await User.updateOne({ uid: 'cg1' }, { emailVerified: true, disabled: true })
    const res = await http.get('/api/admin/users?role=caregiver', 'adm')
    expect(res.body.data.users[0]).toMatchObject({ uid: 'cg1', emailVerified: true, disabled: true })
  })
})
