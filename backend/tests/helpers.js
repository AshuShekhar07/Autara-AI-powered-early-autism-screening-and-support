const crypto = require('crypto')
const mongoose = require('mongoose')
const request = require('supertest')
const User = require('../models/User')
const Child = require('../models/Child')

let memoryServer = null

/**
 * Connects to a throw-away database.
 *  - TEST_MONGODB_URI set  → use it (CI service container, or any local mongod), unique DB name per call
 *  - otherwise             → start mongodb-memory-server
 */
async function connectTestDb() {
  const dbName = `autara_test_${crypto.randomBytes(4).toString('hex')}`
  let uri = process.env.TEST_MONGODB_URI
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server')
    memoryServer = await MongoMemoryServer.create()
    uri = memoryServer.getUri()
  }
  const url = new URL(uri)
  url.pathname = `/${dbName}`
  await mongoose.connect(url.toString())
  return dbName
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) {
    if (process.env.TEST_MONGODB_URI) await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
  if (memoryServer) { await memoryServer.stop(); memoryServer = null }
}

async function clearDb() {
  const collections = await mongoose.connection.db.collections()
  await Promise.all(collections.map((c) => c.deleteMany({})))
}

/** Authorization header value accepted by the mocked verifyIdToken. */
const bearer = (uid, email = `${uid}@demo.test`) => `Bearer ${uid}|${email}`

/** Authenticated supertest agent helpers. */
function api(app) {
  const wrap = (method) => (path, uid, email) => {
    const r = request(app)[method](path)
    return uid ? r.set('Authorization', bearer(uid, email)) : r
  }
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), delete: wrap('delete') }
}

const roleDetailsFor = (role) =>
  ['therapist', 'clinician'].includes(role)
    ? { orgName: 'Demo Clinic (synthetic)', licenseNumber: 'DEMO-0001' }
    : { childName: 'Demo Child', childDob: '2024-06-01' }

async function makeUser(uid, role, extra = {}) {
  return User.create({
    uid, name: `Demo ${uid}`, email: `${uid}@demo.test`, role,
    roleDetails: roleDetailsFor(role), ...extra,
  })
}

/** ISO date string for a child that is `months` old today (synthetic). */
function dobForAge(months) {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - months)
  d.setUTCDate(Math.min(d.getUTCDate(), 28))
  return d.toISOString().slice(0, 10)
}

async function makeChild(caregiverUid, { name = 'Synthetic Child', ageMonths = 22, careTeam = [] } = {}) {
  return Child.create({ caregiverUid, name, dob: new Date(dobForAge(ageMonths)), careTeam })
}

module.exports = { connectTestDb, disconnectTestDb, clearDb, bearer, api, makeUser, makeChild, dobForAge }
