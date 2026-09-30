const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { CARE_ROLES, CLINICAL_ROLES } = require('../utils/roles')
const c = require('../controllers/screeningController')

const router = express.Router()
const anyChildRole = requireRole([...CARE_ROLES, ...CLINICAL_ROLES])
const careRole     = requireRole(CARE_ROLES)

router.use(verifyFirebaseToken)

router.get('/instrument', anyChildRole, c.instrument) // before '/:id'
router.post('/',          careRole,     c.createScreening)
router.get('/',           anyChildRole, c.listScreenings)
router.get('/:id',        anyChildRole, c.getScreening)
router.post('/:id/retry', careRole,     c.retryScreening)

module.exports = router
