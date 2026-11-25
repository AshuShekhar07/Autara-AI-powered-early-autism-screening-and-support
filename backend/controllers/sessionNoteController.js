const SessionNote = require('../models/SessionNote')
const User = require('../models/User')
const { AppError, ok, created, asyncHandler } = require('../utils/respond')
const { requireBodyObject, cleanString, parseLimit, parseDate, isObjectId } = require('../utils/validate')
const { audit } = require('../lib/audit')

async function withAuthors(notes) {
  const users = await User.find({ uid: { $in: [...new Set(notes.map((n) => n.authorUid))] } }).lean()
  const names = Object.fromEntries(users.map((u) => [u.uid, u.name]))
  return notes.map((n) => ({
    id: String(n._id), childId: String(n.childId), text: n.text, createdAt: n.createdAt, editedAt: n.editedAt || null,
    authorUid: n.authorUid, authorName: names[n.authorUid] || 'Unknown',
  }))
}

/** POST /api/children/:id/session-notes { text } (therapist on the care team) */
const createNote = asyncHandler(async (req, res) => {
  const text = cleanString(requireBodyObject(req).text, { max: 4000 })
  if (!text) throw new AppError(400, 'VALIDATION_ERROR', 'Note text is required (up to 4000 characters).')
  const note = await SessionNote.create({ childId: req.child._id, authorUid: req.dbUser.uid, text })
  await audit(req, 'SESSION_NOTE_ADDED', { type: 'session_note', id: note._id }, { childId: String(req.child._id) })
  return created(res, { note: (await withAuthors([note]))[0] })
})

/** GET /api/children/:id/session-notes?limit=&before= (verified care-team professionals) */
const listNotes = asyncHandler(async (req, res) => {
  const filter = { childId: req.child._id }
  if (req.query.before !== undefined) {
    const d = parseDate(req.query.before)
    if (!d) throw new AppError(400, 'VALIDATION_ERROR', '"before" must be a date.')
    filter.createdAt = { $lt: d }
  }
  const limit = parseLimit(req.query.limit, 20, 100)
  const rows = await SessionNote.find(filter).sort({ createdAt: -1 }).limit(limit + 1)
  const page = rows.slice(0, limit)
  return ok(res, { notes: await withAuthors(page), nextBefore: rows.length > limit ? page[page.length - 1].createdAt : null })
})

/** Loads a note of this child written by the requesting therapist (anything else → 404). */
async function ownNote(req) {
  const id = req.params.noteId
  const note = isObjectId(id) && await SessionNote.findOne({ _id: id, childId: req.child._id })
  if (!note) throw new AppError(404, 'NOTE_NOT_FOUND', 'Session note not found.')
  if (note.authorUid !== req.dbUser.uid) throw new AppError(403, 'NOT_NOTE_AUTHOR', 'Only the therapist who wrote this note can change it.')
  return note
}

/** PATCH /api/children/:id/session-notes/:noteId { text } (the note's author) */
const updateNote = asyncHandler(async (req, res) => {
  const text = cleanString(requireBodyObject(req).text, { max: 4000 })
  if (!text) throw new AppError(400, 'VALIDATION_ERROR', 'Note text is required (up to 4000 characters).')
  const note = await ownNote(req)
  note.text = text
  note.editedAt = new Date()
  await note.save()
  await audit(req, 'SESSION_NOTE_EDITED', { type: 'session_note', id: note._id }, { childId: String(req.child._id) })
  return ok(res, { note: (await withAuthors([note]))[0] })
})

/** DELETE /api/children/:id/session-notes/:noteId (the note's author) */
const deleteNote = asyncHandler(async (req, res) => {
  const note = await ownNote(req)
  await note.deleteOne()
  await audit(req, 'SESSION_NOTE_DELETED', { type: 'session_note', id: note._id }, { childId: String(req.child._id) })
  return ok(res, { deleted: true })
})

module.exports = { createNote, listNotes, updateNote, deleteNote }
