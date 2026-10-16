const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { CARE_ROLES, CLINICAL_ROLES } = require('../utils/roles')
const c = require('../controllers/reportController')

const router = express.Router()
router.use(verifyFirebaseToken)

// Therapists are read-only and cannot export.
router.post('/export', requireRole([...CARE_ROLES, 'clinician']), c.exportReport)
router.get('/',        requireRole([...CARE_ROLES, ...CLINICAL_ROLES]), c.listReports)

module.exports = router
