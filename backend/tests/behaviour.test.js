const app = require('../app')
const BehaviourLog = require('../models/BehaviourLog')
const AuditLog = require('../models/AuditLog')
const { localFacets } = require('../lib/localTime')
const { computeBehaviourSummary } = require('../lib/behaviourSummary')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser, makeChild } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

async function world() {
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver')
  await makeUser('th1', 'therapist', { verified: true })
  await makeUser('cl1', 'clinician', { verified: true })
  const child = await makeChild('cg1', { careTeam: [{ uid: 'th1', role: 'therapist' }, { uid: 'cl1', role: 'clinician' }] })
  return String(child._id)
}

const valid = (over = {}) => ({
  occurredAt: '2026-09-01T14:30:00Z',
  antecedent: { category: 'transition', notes: 'Leaving the park' },
  behaviour: { category: 'meltdown_tantrum', description: 'Cried and dropped to the floor' },
  consequence: { category: 'comforted' },
  intensity: 3, durationMinutes: 10, setting: 'public', ...over,
})

describe('local time facets', () => {
  it('shifts by the tz offset before reading hour / weekday / week', () => {
    // Tue 2026-09-01 22:30 UTC. In India (+330) it's already Wed 04:00 next day; in US Eastern (-240) it's Tue 18:30.
    expect(localFacets('2026-09-01T22:30:00Z', 330)).toEqual({ hour: 4, weekday: 2, weekStart: '2026-08-31' })
    expect(localFacets('2026-09-01T22:30:00Z', -240)).toEqual({ hour: 18, weekday: 1, weekStart: '2026-08-31' })
  })
  it('puts Sunday in the previous Monday-based week', () => {
    expect(localFacets('2026-09-06T12:00:00Z', 0)).toEqual({ hour: 12, weekday: 6, weekStart: '2026-08-31' })
    expect(localFacets('2026-09-07T00:00:00Z', 0).weekStart).toBe('2026-09-07')
  })
})

describe('behaviour log CRUD + access', () => {
  it('caregiver and therapist can log; clinician cannot; strangers get 404', async () => {
    const id = await world()
    const a = await http.post(`/api/children/${id}/behaviour-logs`, 'cg1').send(valid({ tzOffsetMinutes: 330 }))
    expect(a.status).toBe(201)
    expect(a.body.data.log).toMatchObject({ loggedBy: 'cg1', loggedByRole: 'caregiver', intensity: 3 })
    const stored = await BehaviourLog.findById(a.body.data.log.id)
    expect(stored.local).toMatchObject({ hour: 20, weekday: 1 }) // 14:30Z + 5:30 = 20:00 Tue
    expect((await http.post(`/api/children/${id}/behaviour-logs`, 'th1').send(valid())).status).toBe(201)
    expect((await http.post(`/api/children/${id}/behaviour-logs`, 'cl1').send(valid())).status).toBe(403)
    expect((await http.post(`/api/children/${id}/behaviour-logs`, 'cg2').send(valid())).status).toBe(404)
    expect((await http.get(`/api/children/${id}/behaviour-logs`, 'cg2')).status).toBe(404)
  })

  it('defaults occurredAt to now and validates input', async () => {
    const id = await world()
    const { occurredAt, ...noTime } = valid()
    const ok = await http.post(`/api/children/${id}/behaviour-logs`, 'cg1').send(noTime)
    expect(ok.status).toBe(201)
    expect(Math.abs(Date.now() - new Date(ok.body.data.log.occurredAt).getTime())).toBeLessThan(5000)

    const bad = async (over) => (await http.post(`/api/children/${id}/behaviour-logs`, 'cg1').send(valid(over))).status
    expect(await bad({ intensity: 6 })).toBe(400)
    expect(await bad({ intensity: 2.5 })).toBe(400)
    expect(await bad({ behaviour: { category: 'made_up' } })).toBe(400)
    expect(await bad({ antecedent: 'transition' })).toBe(400)
    expect(await bad({ setting: 'mars' })).toBe(400)
    expect(await bad({ occurredAt: '2999-01-01T00:00:00Z' })).toBe(400)
    expect(await bad({ durationMinutes: -1 })).toBe(400)
  })

  it('lists with filters and cursor pagination', async () => {
    const id = await world()
    for (let d = 1; d <= 5; d++) {
      await http.post(`/api/children/${id}/behaviour-logs`, 'cg1').send(valid({
        occurredAt: `2026-09-0${d}T10:00:00Z`,
        behaviour: { category: d % 2 ? 'meltdown_tantrum' : 'withdrawal' },
      }))
    }
    const p1 = await http.get(`/api/children/${id}/behaviour-logs?limit=2`, 'cl1') // clinicians may read
    expect(p1.body.data.logs.map((l) => l.occurredAt.slice(8, 10))).toEqual(['05', '04'])
    const p2 = await http.get(`/api/children/${id}/behaviour-logs?limit=2&before=${encodeURIComponent(p1.body.data.nextBefore)}`, 'cg1')
    expect(p2.body.data.logs.map((l) => l.occurredAt.slice(8, 10))).toEqual(['03', '02'])
    const cat = await http.get(`/api/children/${id}/behaviour-logs?category=withdrawal`, 'cg1')
    expect(cat.body.data.logs).toHaveLength(2)
    const range = await http.get(`/api/children/${id}/behaviour-logs?from=2026-09-02T00:00:00Z&to=2026-09-03T23:59:59Z`, 'cg1')
    expect(range.body.data.logs).toHaveLength(2)
    expect((await http.get(`/api/children/${id}/behaviour-logs?category=nope`, 'cg1')).status).toBe(400)
  })

  it('only the author can edit or delete (audited); recomputes local facets', async () => {
    const id = await world()
    const logId = (await http.post(`/api/children/${id}/behaviour-logs`, 'cg1').send(valid())).body.data.log.id
    expect((await http.patch(`/api/children/${id}/behaviour-logs/${logId}`, 'th1').send({ intensity: 1 })).body.error.code).toBe('AUTHOR_ONLY')
    expect((await http.delete(`/api/children/${id}/behaviour-logs/${logId}`, 'th1')).status).toBe(403)

    const patched = await http.patch(`/api/children/${id}/behaviour-logs/${logId}`, 'cg1').send({ intensity: 5, occurredAt: '2026-09-02T08:00:00Z', tzOffsetMinutes: 0 })
    expect(patched.body.data.log.intensity).toBe(5)
    expect((await BehaviourLog.findById(logId)).local).toMatchObject({ hour: 8, weekday: 2 })

    expect((await http.delete(`/api/children/${id}/behaviour-logs/${logId}`, 'cg1')).status).toBe(200)
    expect(await BehaviourLog.countDocuments()).toBe(0)
    expect(await AuditLog.countDocuments({ action: { $in: ['BEHAVIOUR_LOG_UPDATED', 'BEHAVIOUR_LOG_DELETED'] } })).toBe(2)
    expect((await http.delete(`/api/children/${id}/behaviour-logs/${logId}`, 'cg1')).status).toBe(404)
  })
})

describe('behaviour summary math', () => {
  async function seed(childId) {
    // 7 hand-made logs; expected numbers are computed by hand in the assertions below.
    const rows = [
      // when (UTC, tz 0)          antecedent           behaviour            consequence   intensity
      ['2026-08-31T09:00:00Z', 'transition',        'meltdown_tantrum', 'comforted',            4], // Mon wk 08-31
      ['2026-09-01T09:30:00Z', 'transition',        'meltdown_tantrum', 'comforted',            2], // Tue wk 08-31
      ['2026-09-02T17:00:00Z', 'transition',        'meltdown_tantrum', 'removed_from_situation', 3], // Wed wk 08-31
      ['2026-09-03T17:15:00Z', 'demand_or_task',    'withdrawal',       'demand_removed',       5], // Thu wk 08-31
      ['2026-09-04T09:00:00Z', 'demand_or_task',    'meltdown_tantrum', 'demand_removed',       1], // Fri wk 08-31
      // week 09-07 skipped entirely (gap) …
      ['2026-09-14T09:00:00Z', 'sensory_noise_light', 'self_injury',    'redirected',           5], // Mon wk 09-14
      ['2026-09-14T17:00:00Z', 'transition',        'meltdown_tantrum', 'comforted',            5], // Mon wk 09-14
    ]
    for (const [when, a, b, c, intensity] of rows) {
      const { localFacets: lf } = require('../lib/localTime')
      await BehaviourLog.create({
        childId, loggedBy: 'cg1', loggedByRole: 'caregiver', occurredAt: new Date(when),
        antecedent: { category: a }, behaviour: { category: b }, consequence: { category: c },
        intensity, local: lf(when, 0),
      })
    }
  }

  it('computes counts, averages, matrix, consequences, weekly trend, hour/weekday and top pairs', async () => {
    const id = await world()
    await seed(id)
    const s = await computeBehaviourSummary(id)

    expect(s.totalLogs).toBe(7)
    expect(s.averageIntensity).toBe(3.57) // (4+2+3+5+1+5+5)/7 = 25/7

    expect(s.byBehaviour).toEqual([
      { category: 'meltdown_tantrum', count: 5, averageIntensity: 3 },     // (4+2+3+1+5)/5
      // ties are broken by the fixed enum order (self_injury comes before withdrawal)
      { category: 'self_injury', count: 1, averageIntensity: 5 },
      { category: 'withdrawal', count: 1, averageIntensity: 5 },
    ])

    expect(s.matrix[0]).toEqual({ antecedent: 'transition', behaviour: 'meltdown_tantrum', count: 4 })
    expect(s.matrix).toHaveLength(4)
    expect(s.matrix.reduce((n, r) => n + r.count, 0)).toBe(7)

    const tantrumConsequences = s.consequencesByBehaviour.filter((r) => r.behaviour === 'meltdown_tantrum')
    expect(Object.fromEntries(tantrumConsequences.map((r) => [r.consequence, r.count])))
      .toEqual({ comforted: 3, removed_from_situation: 1, demand_removed: 1 })

    expect(s.weeklyTrend).toEqual([
      { weekStart: '2026-08-31', count: 5, averageIntensity: 3 },
      { weekStart: '2026-09-07', count: 0, averageIntensity: null }, // gap week is zero-filled
      { weekStart: '2026-09-14', count: 2, averageIntensity: 5 },
    ])

    expect(s.byHour).toHaveLength(24)
    expect(s.byHour.filter((h) => h.count).map((h) => [h.hour, h.count])).toEqual([[9, 4], [17, 3]])
    expect(s.byWeekday.map((d) => d.count)).toEqual([3, 1, 1, 1, 1, 0, 0]) // Mon: 08-31 09:00, 09-14 ×2

    expect(s.topPairs).toHaveLength(3)
    expect(s.topPairs[0]).toEqual({ antecedent: 'transition', behaviour: 'meltdown_tantrum', count: 4, share: 0.57 })
  })

  it('respects from/to and returns clean empties', async () => {
    const id = await world()
    await seed(id)
    const early = await computeBehaviourSummary(id, { from: new Date('2026-08-31T00:00:00Z'), to: new Date('2026-09-04T23:59:59Z') })
    expect(early.totalLogs).toBe(5)
    const none = await computeBehaviourSummary(id, { from: new Date('2027-01-01T00:00:00Z') })
    expect(none).toMatchObject({ totalLogs: 0, averageIntensity: null, weeklyTrend: [], matrix: [], topPairs: [] })
    expect(none.byHour).toHaveLength(24)
  })

  it('is scoped to one child and exposed via the API for the care team', async () => {
    const id = await world()
    await seed(id)
    const other = String((await makeChild('cg2'))._id)
    await BehaviourLog.create({ childId: other, loggedBy: 'cg2', loggedByRole: 'caregiver', occurredAt: new Date(), antecedent: { category: 'other' }, behaviour: { category: 'other' }, consequence: { category: 'other' }, intensity: 1, local: localFacets(new Date(), 0) })
    const res = await http.get(`/api/children/${id}/behaviour-summary`, 'th1')
    expect(res.status).toBe(200)
    expect(res.body.data.summary.totalLogs).toBe(7)
    expect((await http.get(`/api/children/${id}/behaviour-summary`, 'cg2')).status).toBe(404)
    expect((await http.get(`/api/children/${id}/behaviour-summary?from=garbage`, 'cg1')).status).toBe(400)
  })
})
