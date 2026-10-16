const http = require('http')
const aiClient = require('../lib/aiClient')

let server, calls
function start(handler) {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => { calls.push(req); handler(req, res) })
    server.listen(0, '127.0.0.1', () => {
      process.env.AI_SERVICE_URL = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
}
beforeEach(() => { calls = [] })
afterEach(() => new Promise((r) => (server ? server.close(r) : r())).then(() => { server = null }))

it('sends the internal key and returns parsed JSON', async () => {
  await start((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"riskScore":3}') })
  const out = await aiClient.screen({ answers: {} })
  expect(out).toEqual({ riskScore: 3 })
  expect(calls[0].headers['x-internal-key']).toBe('test-internal-key')
})

it('maps a refused connection to AI_SERVICE_UNAVAILABLE after one retry', async () => {
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:1' // nothing listens here
  await expect(aiClient.screen({})).rejects.toMatchObject({ status: 503, code: 'AI_SERVICE_UNAVAILABLE' })
})

it('maps upstream errors to AI_SERVICE_ERROR without leaking internals', async () => {
  await start((_req, res) => { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end('{"detail":"boom"}') })
  await expect(aiClient.screen({})).rejects.toMatchObject({ status: 500, code: 'AI_SERVICE_ERROR' })
})

it('treats a bad internal key as a configuration error', async () => {
  await start((_req, res) => { res.statusCode = 401; res.end('{}') })
  await expect(aiClient.screen({})).rejects.toMatchObject({ code: 'AI_SERVICE_ERROR', message: expect.stringMatching(/AI_SERVICE_KEY/) })
})

it('times out slow responses', async () => {
  await start(() => { /* never answer */ })
  const orig = aiClient.TIMEOUTS.screen
  aiClient.TIMEOUTS.screen = 150
  await expect(aiClient.screen({})).rejects.toMatchObject({ code: 'AI_SERVICE_TIMEOUT' })
  aiClient.TIMEOUTS.screen = orig
})
