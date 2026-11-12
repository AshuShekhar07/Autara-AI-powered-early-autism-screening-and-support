// An attacker (or a buggy client) firing many requests at once must not slip past the per-user Ask limit.
process.env.ASK_RATE_LIMIT_PER_HOUR = '5'
jest.mock('../lib/aiClient')
const aiClient = require('../lib/aiClient')
const app = require('../app')
const { limit } = require('../routes/assistant')
const { connectTestDb, disconnectTestDb, clearDb, api, makeUser } = require('./helpers')

const http = api(app)
beforeAll(connectTestDb)
afterAll(disconnectTestDb)
beforeEach(async () => {
  await clearDb(); jest.resetAllMocks(); await limit.reset()
  aiClient.ask.mockResolvedValue({ answer: 'ok', sources: [], guardrail: null })
  await makeUser('cg1', 'caregiver'); await makeUser('cg2', 'caregiver')
})

it('30 simultaneous questions let at most 5 through to the AI service', async () => {
  const results = await Promise.all(Array.from({ length: 30 }, () => http.post('/api/assistant/ask', 'cg1').send({ question: 'What is a follow-up interview?' })))
  const ok = results.filter((r) => r.status === 200).length
  const limited = results.filter((r) => r.status === 429).length
  expect(ok).toBeLessThanOrEqual(5)
  expect(ok + limited).toBe(30)
  expect(aiClient.ask).toHaveBeenCalledTimes(ok)
})

it('after a burst the user stays limited, other users are unaffected and refused attempts are not stored', async () => {
  const burst = await Promise.all(Array.from({ length: 12 }, () => http.post('/api/assistant/ask', 'cg1').send({ question: 'hello there' })))
  let allowed = burst.filter((r) => r.status === 200).length
  for (let i = 0; i < 8; i++) { // then ask one at a time until the limit bites
    const r = await http.post('/api/assistant/ask', 'cg1').send({ question: 'one more' })
    if (r.status === 200) allowed++
  }
  expect(allowed).toBeLessThanOrEqual(5)
  expect((await http.post('/api/assistant/ask', 'cg1').send({ question: 'and another' })).status).toBe(429)
  expect((await http.post('/api/assistant/ask', 'cg2').send({ question: 'my first' })).status).toBe(200)
  const RateLimitHit = require('../models/RateLimitHit')
  expect(await RateLimitHit.countDocuments({ key: 'cg1' })).toBeLessThanOrEqual(5)
})
