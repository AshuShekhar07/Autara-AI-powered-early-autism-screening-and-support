const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { CLINICAL_ROLES }  = require('../utils/roles')
const { caseload }        = require('../controllers/childController')

const router = express.Router()

/** GET /api/me/caseload — therapist / clinician (verified) */
router.get('/caseload', verifyFirebaseToken, requireRole(CLINICAL_ROLES), caseload)

module.exports = router
