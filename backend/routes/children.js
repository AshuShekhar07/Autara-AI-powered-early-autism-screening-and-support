const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { childAccess, requireChildOwner } = require('../middleware/childAccess')
const { CARE_ROLES, CLINICAL_ROLES }     = require('../utils/roles')
const c = require('../controllers/childController')

const router = express.Router()

const anyChildRole = requireRole([...CARE_ROLES, ...CLINICAL_ROLES])
const careRole     = requireRole(CARE_ROLES)

router.use(verifyFirebaseToken)

router.get('/',    anyChildRole, c.listChildren)
router.post('/',   careRole,     c.createChild)

router.get('/:id',   anyChildRole, childAccess(), c.getChild)
router.patch('/:id', careRole,     childAccess(), requireChildOwner, c.updateChild)

router.get('/:id/care-team',          anyChildRole, childAccess(), c.getCareTeam)
router.post('/:id/care-team',         careRole, childAccess(), requireChildOwner, c.addCareTeamMember)
router.delete('/:id/care-team/:uid',  careRole, childAccess(), requireChildOwner, c.removeCareTeamMember)

module.exports = router
