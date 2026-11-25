const Child = require('../models/Child')
const Screening = require('../models/Screening')
const BehaviourLog = require('../models/BehaviourLog')
const SessionNote = require('../models/SessionNote')
const Insight = require('../models/Insight')
const Report = require('../models/Report')

/**
 * Permanently removes a child and everything recorded about them: screenings, behaviour logs, session notes,
 * AI insights and report-history rows. Audit-log rows are kept (they hold ids and counts, no child details).
 * Used by "Delete child" and "Delete my account".
 * @returns {Promise<{screenings:number, behaviourLogs:number, sessionNotes:number, insights:number, reports:number}>}
 */
async function deleteChildData(childId) {
  const filter = { childId }
  const [screenings, behaviourLogs, sessionNotes, insights, reports] = await Promise.all([
    Screening.deleteMany(filter), BehaviourLog.deleteMany(filter), SessionNote.deleteMany(filter),
    Insight.deleteMany(filter), Report.deleteMany(filter),
  ])
  await Child.deleteOne({ _id: childId })
  return {
    screenings: screenings.deletedCount, behaviourLogs: behaviourLogs.deletedCount,
    sessionNotes: sessionNotes.deletedCount, insights: insights.deletedCount, reports: reports.deletedCount,
  }
}

module.exports = { deleteChildData }
