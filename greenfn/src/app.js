const express = require('express')
const cors = require('cors')
const apiRouter = require('./routes')
const { requestLogger } = require('./middleware/requestLogger')
const { notFoundHandler } = require('./middleware/notFound')
const { errorHandler } = require('./middleware/errorHandler')

function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(requestLogger)

  app.get('/', (_req, res) => {
    res.json({ service: 'greenfn-api', status: 'ok' })
  })

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

module.exports = { createApp }
