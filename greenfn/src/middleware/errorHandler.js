function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500
  const payload = {
    error: {
      message: error.message || 'Internal server error',
    },
  }

  if (error.details) {
    payload.error.details = error.details
  }

  if (process.env.NODE_ENV !== 'production' && error.stack) {
    payload.error.stack = error.stack
  }

  res.status(statusCode).json(payload)
}

module.exports = { errorHandler }
