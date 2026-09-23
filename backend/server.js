require('dotenv').config()

const dns = require('dns')
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

// Use reliable public DNS resolvers for MongoDB Atlas SRV lookup.
// This works around the local DNS resolver returning ECONNREFUSED.
dns.setServers(['1.1.1.1', '8.8.8.8'])

// ── Validate required env vars ──
const REQUIRED_ENV = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'MONGODB_URI',
]

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`)
    console.error(
      'Copy backend/.env.example to backend/.env and fill in all values.'
    )
    process.exit(1)
  }
}

// ── App setup ──
const app = express()
const PORT = process.env.PORT || 4000

// CORS — allow listed origins only
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3001'
)
  .split(',')
  .map((origin) => origin.trim())

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server requests with no Origin header
      // and requests from explicitly allowed frontend origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true)
      }

      cb(new Error(`CORS policy blocks origin: ${origin}`))
    },
    credentials: true,
  })
)

app.use(express.json())

// ── Routes ──
app.use('/api/auth', require('./routes/auth'))

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// ── 404 catch-all ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' })
})

// ── Global error handler ──
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err)
  res.status(500).json({ error: 'Internal server error.' })
})

// ── MongoDB + listen ──
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    // Never log the MongoDB URI because it contains credentials.
    console.log('[mongodb] Connected to MongoDB')

    app.listen(PORT, () => {
      console.log(
        `[server] Autara backend running on http://localhost:${PORT}`
      )
    })
  })
  .catch((err) => {
    console.error('[mongodb] Connection failed:', err.message)
    process.exit(1)
  })