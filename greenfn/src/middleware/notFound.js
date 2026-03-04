const { httpError } = require('../utils/httpError')

function notFoundHandler(req, _res, next) {
  next(httpError(404, `Route not found: ${req.method} ${req.originalUrl}`))
}

module.exports = { notFoundHandler }
