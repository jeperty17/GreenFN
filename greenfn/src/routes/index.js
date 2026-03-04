const express = require('express')
const authRoutes = require('../modules/auth/routes')
const contactsRoutes = require('../modules/contacts/routes')
const pipelineRoutes = require('../modules/pipeline/routes')
const taskRoutes = require('../modules/tasks/routes')
const interactionRoutes = require('../modules/interactions/routes')
const aiRoutes = require('../modules/ai/routes')

const router = express.Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/auth', authRoutes)
router.use('/contacts', contactsRoutes)
router.use('/pipeline', pipelineRoutes)
router.use('/tasks', taskRoutes)
router.use('/interactions', interactionRoutes)
router.use('/ai', aiRoutes)

module.exports = router
