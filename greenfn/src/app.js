const express = require('express')
const cors = require('cors')
const apiRouter = require('./routes')
const internalRoutes = require('./modules/internal/routes')
const { NODE_ENV, CORS_ALLOWED_ORIGINS, API_BASE_PATH } = require('./config/env')
const { requestLogger } = require('./middleware/requestLogger')
const { createOperationRecorder } = require('./middleware/operationRecorder')
const { notFoundHandler } = require('./middleware/notFound')
const { errorHandler } = require('./middleware/errorHandler')

function resolveCorsOptions() {
  if (NODE_ENV !== 'production') {
    return {}
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('CORS origin not allowed'))
    },
    credentials: true,
  }
}

function createApp() {
  const app = express()

  app.use(cors(resolveCorsOptions()))
  app.use(express.json())
  app.use(requestLogger)
  app.use(createOperationRecorder({ apiBasePath: API_BASE_PATH }))

  app.get('/', (_req, res) => {
    res.json({ service: 'greenfn-api', status: 'ok' })
  })

  app.use('/internal', internalRoutes)
  app.use(API_BASE_PATH, apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

module.exports = { createApp }
