const { mapPrismaError } = require('../utils/prismaError')

function errorHandler(error, _req, res, _next) {
  const mappedError = mapPrismaError(error)
  const statusCode = mappedError.statusCode || 500
  const payload = {
    error: {
      message: mappedError.message || 'Internal server error',
    },
  }

  if (mappedError.details) {
    payload.error.details = mappedError.details
  }

  if (process.env.NODE_ENV !== 'production' && mappedError.stack) {
    payload.error.stack = mappedError.stack
  }

  res.status(statusCode).json(payload)
}

module.exports = { errorHandler }
