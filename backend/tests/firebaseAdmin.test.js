// Checks the REAL lib/firebaseAdmin (the other suites mock it) initialises with the installed
// firebase-admin major version. Runs in a child Node process because Jest's CommonJS sandbox cannot
// load firebase-admin's ESM-only dependency (jose). No network: a throw-away RSA key is generated locally.
const { execFileSync } = require('child_process')
const path = require('path')

it('initialises with the installed firebase-admin and exposes auth().verifyIdToken', () => {
  const script = `
    const crypto = require('crypto')
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
    process.env.FIREBASE_PROJECT_ID = 'demo-project'
    process.env.FIREBASE_CLIENT_EMAIL = 'demo@demo-project.iam.gserviceaccount.com'
    process.env.FIREBASE_PRIVATE_KEY = privateKey.replace(/\\n/g, '\\\\n')   // as stored in .env
    const admin = require('./lib/firebaseAdmin')
    console.log(typeof admin.auth().verifyIdToken, admin.auth() === admin.auth())
  `
  const out = execFileSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })
  expect(out.trim()).toBe('function true')
})
