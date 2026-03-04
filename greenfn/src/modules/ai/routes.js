const express = require('express')
const { validateBody, requiredString } = require('../../middleware/validate')

const router = express.Router()

function validateGenerateSummary(body) {
  const errors = []
  requiredString(body.contactId, 'contactId', errors)
  requiredString(body.input, 'input', errors)
  return errors
}

router.get('/', (_req, res) => {
  res.json({ module: 'ai', status: 'ready' })
})

router.post('/summaries', validateBody(validateGenerateSummary), (req, res) => {
  res.status(501).json({
    message: 'AI summary generation endpoint scaffolded',
    payload: req.body,
  })
})

module.exports = router
