const { execFileSync } = require('child_process')
const path = require('path')
const User = require('../models/User')
const Child = require('../models/Child')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const SessionNote = require('../models/SessionNote')
const { computeBehaviourSummary } = require('../lib/behaviourSummary')
const { connectTestDb, disconnectTestDb, clearDb, makeUser, testDbUri } = require('./helpers')

beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(clearDb)

/** Runs the real script in a child process against the same throw-away database. */
function seed(args) {
  return execFileSync(process.execPath, ['scripts/seedDemo.js', ...args], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, MONGODB_URI: testDbUri() }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
}
const args = ['--caregiver', 'cg@demo.test', '--therapist', 'th@demo.test', '--clinician', 'cl@demo.test']

async function accounts() {
  await makeUser('cg', 'caregiver'); await makeUser('th', 'therapist'); await makeUser('cl', 'clinician')   // therapist/clinician start unverified
}

it('attaches synthetic children, one screening per tier, ~60 logs, care-team links (and verifies the pros)', async () => {
  await accounts()
  const out = seed(args)
  expect(out).toMatch(/Seeded synthetic demo data/)

  const children = await Child.find({ caregiverUid: 'cg' })
  expect(children.map((c) => c.name).sort()).toEqual(['River (demo)', 'Sky (demo)'])
  for (const c of children) expect(c.careTeam.map((m) => m.uid).sort()).toEqual(['cl', 'th'])
  expect((await User.findOne({ uid: 'cl' })).verified).toBe(true)

  const screenings = await Screening.find({ demoTag: 'demo-seed-v1' })
  expect(screenings.map((s) => s.riskTier).sort()).toEqual(['high', 'low', 'medium'])
  const byTier = Object.fromEntries(screenings.map((s) => [s.riskTier, s]))
  expect(byTier.low.riskScore).toBe(2); expect(byTier.medium.riskScore).toBe(5); expect(byTier.high.riskScore).toBe(10)   // official scoring rules
  expect(byTier.medium.clinicianReview.override).toMatchObject({ originalTier: 'medium', riskTier: 'low' })
  expect(byTier.high.status).toBe('INSIGHTS_READY')                                                                    // waiting in the queue
  expect(screenings.every((s) => Object.keys(s.answers).length === 20)).toBe(true)

  const river = children.find((c) => c.name.startsWith('River'))
  expect(await BehaviourLog.countDocuments({ childId: river._id })).toBe(60)
  expect(await SessionNote.countDocuments({ childId: river._id })).toBe(2)
})

it('produces realistic, chart-worthy patterns', async () => {
  await accounts(); seed(args)
  const river = await Child.findOne({ name: 'River (demo)' })
  const s = await computeBehaviourSummary(river._id)
  expect(s.topPairs[0]).toMatchObject({ antecedent: 'transition', behaviour: 'meltdown_tantrum' })
  expect(s.byBehaviour[0].category).toBe('meltdown_tantrum')
  const afternoon = s.byHour.filter((h) => h.hour >= 15 && h.hour <= 18).reduce((n, h) => n + h.count, 0)
  expect(afternoon / s.totalLogs).toBeGreaterThan(0.4)                 // late-afternoon peak
  expect(s.weeklyTrend.length).toBeGreaterThanOrEqual(6)
})

it('is idempotent: re-running does not duplicate anything', async () => {
  await accounts(); seed(args); seed(args)
  expect(await Child.countDocuments()).toBe(2)
  expect(await Screening.countDocuments()).toBe(3)
  expect(await BehaviourLog.countDocuments()).toBe(60)
  expect(await SessionNote.countDocuments()).toBe(2)
})

it('keeps entries that users added themselves when re-seeding', async () => {
  await accounts(); seed(args)
  const river = await Child.findOne({ name: 'River (demo)' })
  await BehaviourLog.create({ childId: river._id, loggedBy: 'cg', loggedByRole: 'caregiver', occurredAt: new Date(), antecedent: { category: 'other' }, behaviour: { category: 'other' }, consequence: { category: 'other' }, intensity: 1, local: { hour: 1, weekday: 1, weekStart: '2026-01-05' } })
  seed(args)
  expect(await BehaviourLog.countDocuments({ childId: river._id })).toBe(61)
})

it('fails clearly for unknown accounts or wrong roles, and contains no real-looking data', async () => {
  await accounts()
  expect(() => seed(['--caregiver', 'nobody@demo.test', '--therapist', 'th@demo.test', '--clinician', 'cl@demo.test'])).toThrow(/No account for nobody@demo.test/)
  expect(() => seed(['--caregiver', 'th@demo.test', '--therapist', 'th@demo.test', '--clinician', 'cl@demo.test'])).toThrow(/is a therapist; expected caregiver or patient/)
  const logs = await BehaviourLog.find({})
  expect(logs).toHaveLength(0)
  const src = require('fs').readFileSync(path.join(__dirname, '../scripts/seedDemo.js'), 'utf8')
  expect(src).toMatch(/SYNTHETIC/)
})
