const { AppError, fail } = require('../utils/respond')

/** 404 for unknown routes — same envelope as everything else. */
function notFound(_req, res) {
  return fail(res, 404, 'ROUTE_NOT_FOUND', 'Route not found.')
}

/**
 * Central error handler. Anything thrown / passed to next(err) ends up here.
 * Known errors keep their code; everything unexpected becomes a generic 500
 * (the real error is logged server-side only — never leaked to the client).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return fail(res, err.status, err.code, err.message, err.details)
  }

  // express.json() failures
  if (err.type === 'entity.parse.failed') {
    return fail(res, 400, 'INVALID_JSON', 'Request body is not valid JSON.')
  }
  if (err.type === 'entity.too.large') {
    return fail(res, 400, 'BODY_TOO_LARGE', 'Request body is too large.')
  }

  // Mongoose
  if (err.name === 'ValidationError') {
    return fail(res, 400, 'VALIDATION_ERROR', 'One or more fields are invalid.',
      Object.fromEntries(Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])))
  }
  if (err.name === 'CastError') {
    return fail(res, 400, 'VALIDATION_ERROR', `Invalid value for "${err.path}".`)
  }
  if (err.code === 11000) {
    return fail(res, 409, 'DUPLICATE', 'That record already exists.')
  }

  console.error('[unhandled error]', err)
  return fail(res, 500, 'INTERNAL_ERROR', 'Internal server error.')
}

module.exports = { notFound, errorHandler }
