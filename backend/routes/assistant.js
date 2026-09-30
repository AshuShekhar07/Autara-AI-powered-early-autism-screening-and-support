const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { rateLimit }       = require('../lib/rateLimit')
const { CARE_ROLES }      = require('../utils/roles')
const { askAutara }       = require('../controllers/assistantController')

const router = express.Router()

const limit = rateLimit({
  max: Number(process.env.ASK_RATE_LIMIT_PER_HOUR) || 20,
  windowMs: 60 * 60 * 1000,
  key: (req) => req.dbUser.uid,
})

router.post('/ask', verifyFirebaseToken, requireRole(CARE_ROLES), limit, askAutara)

module.exports = router
module.exports.limit = limit
