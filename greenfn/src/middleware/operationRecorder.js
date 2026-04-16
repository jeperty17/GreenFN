const { recordOperation } = require('../lib/operationTracker')

function createOperationRecorder({ apiBasePath }) {
  const normalizedApiBasePath = String(apiBasePath || '/api').trim()

  return function operationRecorder(req, res, next) {
    const path = String(req.originalUrl || req.url || '')

    if (!path.startsWith(normalizedApiBasePath)) {
      next()
      return
    }

    const start = process.hrtime.bigint()

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000
      recordOperation({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
      })
    })

    next()
  }
}

module.exports = { createOperationRecorder }
