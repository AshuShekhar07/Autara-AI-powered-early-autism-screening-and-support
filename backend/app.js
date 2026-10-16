const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { AppError, ok, asyncHandler } = require('./utils/respond')
const { notFound, errorHandler } = require('./middleware/errorHandler')
const aiClient = require('./lib/aiClient')

/**
 * Builds the Express app WITHOUT connecting to MongoDB or listening, so tests
 * (supertest) can import it directly. server.js does the connecting/listening.
 */
const app = express()

// CORS — allow listed origins only. Default matches the Vite dev server (port 3000).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())

app.use(helmet())
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server requests with no Origin header and explicitly allowed origins.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new AppError(403, 'CORS_BLOCKED', `CORS policy blocks origin: ${origin}`))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '100kb' }))

// ── Routes ──
app.use('/api/auth',  require('./routes/auth'))
app.use('/api/children', require('./routes/children'))
app.use('/api/me',    require('./routes/me'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/screenings', require('./routes/screenings'))
app.use('/api/insights', require('./routes/insights'))
app.use('/api/assistant', require('./routes/assistant'))
app.use('/api/reports', require('./routes/reports'))

// ── Health checks ──
app.get('/api/health', (_req, res) => ok(res, { status: 'ok' }))
app.get('/api/health/ai', asyncHandler(async (_req, res) => {
  const ai = await aiClient.health()
  return ok(res, { status: 'ok', ai })
}))

app.use(notFound)
app.use(errorHandler)

module.exports = app
