const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { childAccess, requireChildOwner } = require('../middleware/childAccess')
const { CARE_ROLES, CLINICAL_ROLES }     = require('../utils/roles')
const c = require('../controllers/childController')
const b = require('../controllers/behaviourController')

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

// ── Behaviour (ABC) logs ── caregiver / patient / therapist write; verified care-team clinicians read
const logWriter = requireRole([...CARE_ROLES, 'therapist'])
router.post('/:id/behaviour-logs',            logWriter,    childAccess(), b.createLog)
router.get('/:id/behaviour-logs',             anyChildRole, childAccess(), b.listLogs)
router.patch('/:id/behaviour-logs/:logId',    logWriter,    childAccess(), b.updateLog)
router.delete('/:id/behaviour-logs/:logId',   logWriter,    childAccess(), b.deleteLog)
router.get('/:id/behaviour-summary',          anyChildRole, childAccess(), b.summary)

module.exports = router
