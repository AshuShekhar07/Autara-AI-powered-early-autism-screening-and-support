const AuditLog = require('../models/AuditLog')

/**
 * audit(req, action, target, meta)
 *
 * Writes one AuditLog row. The actor comes from the authenticated request
 * (req.dbUser is set by requireRole). Never throws: a failed audit write is
 * logged but must not break the user's request.
 *
 * @param {object} req
 * @param {string} action   e.g. 'SCREENING_OVERRIDDEN'
 * @param {{type: string, id: string}} target
 * @param {object} [meta]   small JSON facts about the action (no free-text PHI)
 */
async function audit(req, action, target, meta = {}) {
  try {
    const actor = req.dbUser || {}
    await AuditLog.create({
      actorUid:   actor.uid  || req.firebaseUser?.uid || 'unknown',
      actorRole:  actor.role || 'unknown',
      action,
      targetType: target.type,
      targetId:   String(target.id),
      meta,
    })
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message)
  }
}

module.exports = { audit }
