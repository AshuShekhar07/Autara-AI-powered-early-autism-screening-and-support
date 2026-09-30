const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { CARE_ROLES, CLINICAL_ROLES } = require('../utils/roles')
const c = require('../controllers/insightController')

const router = express.Router()
router.use(verifyFirebaseToken)

router.post('/generate',    requireRole(['clinician']), c.generate)
router.get('/',             requireRole([...CARE_ROLES, ...CLINICAL_ROLES]), c.list)
router.post('/:id/approve', requireRole(['clinician']), c.approve)

module.exports = router
