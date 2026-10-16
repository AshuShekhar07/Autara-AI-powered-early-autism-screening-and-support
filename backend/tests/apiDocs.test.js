// Guard against documentation drift: every Express route must appear in docs/API.md.
const fs = require('fs')
const path = require('path')
const app = require('../app')

const doc = fs.readFileSync(path.join(__dirname, '../../docs/API.md'), 'utf8')

/** Walks Express 4's router stack and returns ["GET /api/x/:id", ...]. */
function listRoutes(stack, prefix = '') {
  const out = []
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) out.push(`${method.toUpperCase()} ${prefix}${layer.route.path === '/' ? '' : layer.route.path}`)
    } else if (layer.name === 'router' && layer.handle.stack) {
      const mount = layer.regexp.source
        .replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/')
      out.push(...listRoutes(layer.handle.stack, prefix + mount))
    }
  }
  return out
}

const routes = listRoutes(app._router.stack).filter((r) => r.includes('/api/'))

it('finds the routes (sanity)', () => {
  expect(routes.length).toBeGreaterThanOrEqual(43)
  expect(routes).toContain('POST /api/auth/signup')
  expect(routes).toContain('GET /api/children/:id/behaviour-summary')
})

it.each(routes)('docs/API.md documents %s', (route) => {
  const [method, p] = route.split(' ')
  // the docs write "`METHOD /path`" (query strings may follow the path)
  const needle = `${method} ${p}`
  expect(doc.includes('`' + needle + '`') || doc.includes('`' + needle + '?')).toBe(true)
})
