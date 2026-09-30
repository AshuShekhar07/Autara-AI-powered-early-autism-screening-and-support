require('dotenv').config()

const dns = require('dns')
const mongoose = require('mongoose')

// Use reliable public DNS resolvers for MongoDB Atlas SRV lookup.
// This works around the local DNS resolver returning ECONNREFUSED.
// Skipped for plain mongodb:// URIs (local / docker), which don't need SRV.
if ((process.env.MONGODB_URI || '').startsWith('mongodb+srv://')) {
  dns.setServers(['1.1.1.1', '8.8.8.8'])
}

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
    console.error('Copy backend/.env.example to backend/.env and fill in all values.')
    process.exit(1)
  }
}

if (!process.env.AI_SERVICE_KEY) {
  console.warn('[startup] AI_SERVICE_KEY is not set — screening scoring and AI insights will fail until it is.')
}

const app = require('./app')
const PORT = process.env.PORT || 4000

// ── MongoDB + listen ──
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    // Never log the MongoDB URI because it contains credentials.
    console.log('[mongodb] Connected to MongoDB')
    app.listen(PORT, () => {
      console.log(`[server] Autara backend running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('[mongodb] Connection failed:', err.message)
    process.exit(1)
  })
