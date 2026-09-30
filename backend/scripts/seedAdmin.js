/**
 * Promote an existing user to admin.
 *
 *   npm run seed:admin -- someone@example.com
 *
 * The person must have signed up first (signup deliberately blocks role "admin").
 * Reads MONGODB_URI from backend/.env.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog')

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase()
  if (!email) {
    console.error('Usage: npm run seed:admin -- <email>')
    process.exit(1)
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set (see backend/.env.example).')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  try {
    const user = await User.findOne({ email })
    if (!user) {
      console.error(`No user with email "${email}". Ask them to sign up first, then re-run.`)
      process.exitCode = 1
      return
    }
    if (user.role === 'admin') {
      console.log(`${email} is already an admin.`)
      return
    }
    const previousRole = user.role
    user.role = 'admin'
    user.verified = true
    await user.save()
    await AuditLog.create({
      actorUid: 'seed-script', actorRole: 'system', action: 'ADMIN_SEEDED',
      targetType: 'user', targetId: user.uid, meta: { previousRole },
    })
    console.log(`${email} promoted: ${previousRole} → admin.`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => { console.error(err.message); process.exit(1) })
