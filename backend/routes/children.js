const express             = require('express')
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken')
const requireRole         = require('../middleware/requireRole')
const { childAccess, requireChildOwner } = require('../middleware/childAccess')
const { CARE_ROLES, CLINICAL_ROLES }     = require('../utils/roles')
const c = require('../controllers/childController')
const b = require('../controllers/behaviourController')
const m = require('../controllers/milestoneController')
const n = require('../controllers/sessionNoteController')
const d = require('../controllers/dashboardController')

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

// ── Milestones (persisted caregiver statuses) ──
router.get('/:id/milestones', anyChildRole, childAccess(), m.getMilestones)
router.put('/:id/milestones', careRole, childAccess(), requireChildOwner, m.putMilestones)

// ── Session notes: therapists write, verified professionals read (never caregivers) ──
const therapistRole = requireRole(['therapist'])
const clinicalRole  = requireRole(CLINICAL_ROLES)
router.post('/:id/session-notes', therapistRole, childAccess(), n.createNote)
router.get('/:id/session-notes',  clinicalRole,  childAccess(), n.listNotes)

// ── Dashboard feeds ──
router.get('/:id/overview', careRole,      childAccess(), d.overview)
router.get('/:id/timeline', anyChildRole,  childAccess(), d.timeline)

module.exports = router
