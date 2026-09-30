const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const admin               = require('../controllers/adminController')

const router = express.Router()

router.use(verifyFirebaseToken, requireRole(['admin']))

router.get('/users',               admin.listUsers)
router.patch('/users/:uid/verify', admin.verifyUser)

module.exports = router
