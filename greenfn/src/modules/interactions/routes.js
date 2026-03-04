const express = require('express')
const { validateBody, requiredString } = require('../../middleware/validate')

const router = express.Router()

function validateCreateInteraction(body) {
  const errors = []
  requiredString(body.contactId, 'contactId', errors)
  requiredString(body.type, 'type', errors)
  return errors
}

router.get('/', (_req, res) => {
  res.json({ module: 'interactions', status: 'ready' })
})

router.post('/', validateBody(validateCreateInteraction), (req, res) => {
  res.status(501).json({
    message: 'Create interaction endpoint scaffolded',
    payload: req.body,
  })
})

module.exports = router
