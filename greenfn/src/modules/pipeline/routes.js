const express = require('express')
const { validateBody, requiredString } = require('../../middleware/validate')

const router = express.Router()

function validatePipelineStageUpdate(body) {
  const errors = []
  requiredString(body.leadId, 'leadId', errors)
  requiredString(body.stage, 'stage', errors)
  return errors
}

router.get('/', (_req, res) => {
  res.json({ module: 'pipeline', status: 'ready' })
})

router.post('/stage-transition', validateBody(validatePipelineStageUpdate), (req, res) => {
  res.status(501).json({
    message: 'Pipeline stage transition endpoint scaffolded',
    payload: req.body,
  })
})

module.exports = router
