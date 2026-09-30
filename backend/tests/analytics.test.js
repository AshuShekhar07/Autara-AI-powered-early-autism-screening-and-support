const app = require('../app')
const User = require('../models/User')
const Child = require('../models/Child')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const { suppressDistribution, median } = require('../lib/analytics')
const { localFacets } = require('../lib/localTime')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

describe('k-anonymity helpers', () => {
  it('hides buckets under 5 and shows the rest', () => {
    expect(suppressDistribution({ a: 10, b: 5, c: 4 }, { totalPublished: false })).toEqual({ a: 10, b: 5, c: null })
  })
  it('secondary suppression: a lone hidden bucket cannot be recovered by subtraction', () => {
    expect(suppressDistribution({ a: 20, b: 9, c: 2 })).toEqual({ a: 20, b: null, c: null })
    expect(suppressDistribution({ a: 20, b: 9, c: 7 })).toEqual({ a: 20, b: 9, c: 7 })
    expect(suppressDistribution({ a: 1, b: 2, c: 30 })).toEqual({ a: null, b: null, c: 30 })
  })
  it('median', () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); expect(median([])).toBeNull() })
})

async function seedData() {
  await makeUser('adm', 'admin')
  for (let i = 0; i < 6; i++) await makeUser(`cg${i}`, 'caregiver')
  await makeUser('cl-a', 'clinician', { verified: true }); await makeUser('cl-b', 'clinician')        // 1 verified + 1 pending
  const child = await Child.create({ caregiverUid: 'cg0', name: 'Secret Name', dob: new Date('2024-06-01') })
  const mk = (tier, extra = {}) => Screening.create({ childId: child._id, submittedBy: 'cg0', childAgeMonths: 22, answers: {}, riskScore: 5, riskTier: tier, status: 'INSIGHTS_READY', ...extra })
  for (let i = 0; i < 7; i++) await mk('low')
  for (let i = 0; i < 6; i++) await mk('medium')
  for (let i = 0; i < 2; i++) await mk('high')                                                     // only 2 → suppressed
  for (let i = 0; i < 5; i++) {                                                                    // 5 reviewed, each 10h after submission
    const created = new Date(Date.now() - 3600_000 * 20)
    await mk('low', { status: 'REVIEWED', createdAt: created, clinicianReview: { reviewedAt: new Date(created.getTime() + 10 * 3600_000) } })
  }
  for (let i = 0; i < 6; i++) await BehaviourLog.create({ childId: child._id, loggedBy: 'cg0', loggedByRole: 'caregiver', occurredAt: new Date(), antecedent: { category: 'other' }, behaviour: { category: 'other' }, consequence: { category: 'other' }, intensity: 2, local: localFacets(new Date(), 0) })
}

describe('GET /api/admin/analytics', () => {
  it('is admin-only', async () => {
    await seedData()
    expect((await http.get('/api/admin/analytics', 'cg0')).status).toBe(403)
    expect((await http.get('/api/admin/analytics', 'cl-a')).status).toBe(403)
    expect((await http.get('/api/admin/analytics')).status).toBe(401)
  })

  it('returns aggregates only, with small buckets suppressed and no identifiers', async () => {
    await seedData()
    const res = await http.get('/api/admin/analytics', 'adm')
    expect(res.status).toBe(200)
    const a = res.body.data.analytics
    expect(a.k).toBe(5)

    expect(a.totals.users.caregiver).toBe(6)
    expect(a.totals.users.clinician).toBeNull()               // 2 clinicians → hidden
    expect(a.totals.users.therapist).toBeNull()               // 0
    expect(a.totals.children).toBeNull()                      // 1 child → hidden
    expect(a.totals.screenings).toBe(20)

    // 2 high are hidden; secondary suppression also hides the smallest visible bucket (medium) so 'high' can't be derived from the total
    expect(a.riskTierDistribution).toEqual({ low: 12, medium: null, high: null })
    expect(a.medianHoursToReview).toBe(10)
    expect(a.verificationQueueSize).toBe(1)                   // exact (admin sees the queue anyway)

    expect(a.screeningsPerWeek).toHaveLength(12)
    const thisWeek = a.screeningsPerWeek[11]
    expect(thisWeek.count).toBe(20)
    expect(a.screeningsPerWeek.slice(0, 11).every((w) => w.count === null)).toBe(true)  // zero-count weeks are <5 → hidden
    expect(a.logsPerWeek[11].count).toBe(6)

    const json = JSON.stringify(a)
    expect(json).not.toMatch(/Secret Name|cg0|@demo|uid|email|childId|caregiverUid/)
  })

  it('median review time needs at least 5 reviewed screenings', async () => {
    await makeUser('adm', 'admin')
    const child = await Child.create({ caregiverUid: 'x', name: 'N', dob: new Date('2024-06-01') })
    for (let i = 0; i < 4; i++) await Screening.create({ childId: child._id, submittedBy: 'x', childAgeMonths: 22, answers: {}, riskScore: 1, riskTier: 'low', status: 'REVIEWED', clinicianReview: { reviewedAt: new Date() } })
    const a = (await http.get('/api/admin/analytics', 'adm')).body.data.analytics
    expect(a.medianHoursToReview).toBeNull()
    expect(a.riskTierDistribution).toEqual({ low: null, medium: null, high: null })
  })

  it('uses the clinician-overridden tier in the distribution', async () => {
    await makeUser('adm', 'admin')
    const child = await Child.create({ caregiverUid: 'x', name: 'N', dob: new Date('2024-06-01') })
    for (let i = 0; i < 6; i++) await Screening.create({ childId: child._id, submittedBy: 'x', childAgeMonths: 22, answers: {}, riskScore: 9, riskTier: 'high', status: 'REVIEWED', clinicianReview: { reviewedAt: new Date(), override: { riskTier: 'medium', originalTier: 'high', reason: 'because', by: 'c' } } })
    for (let i = 0; i < 5; i++) await Screening.create({ childId: child._id, submittedBy: 'x', childAgeMonths: 22, answers: {}, riskScore: 1, riskTier: 'low', status: 'INSIGHTS_READY' })
    const a = (await http.get('/api/admin/analytics', 'adm')).body.data.analytics
    // high = 0 is hidden → smallest visible (low = 5) is hidden too
    expect(a.riskTierDistribution).toEqual({ low: null, medium: 6, high: null })
  })
})
