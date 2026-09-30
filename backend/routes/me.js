const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { CLINICAL_ROLES }  = require('../utils/roles')
const { caseload, notifications } = require('../controllers/dashboardController')
const { reviewQueue }     = require('../controllers/reviewController')
const { ROLES }           = require('../utils/roles')

const router = express.Router()

/** GET /api/me/caseload — therapist / clinician (verified) */
router.get('/caseload', verifyFirebaseToken, requireRole(CLINICAL_ROLES), caseload)

/** GET /api/me/review-queue — clinician's screenings waiting for review */
router.get('/review-queue', verifyFirebaseToken, requireRole(['clinician']), reviewQueue)

/** GET /api/me/notifications — derived from real data, per role */
router.get('/notifications', verifyFirebaseToken, requireRole(ROLES), notifications)

module.exports = router
