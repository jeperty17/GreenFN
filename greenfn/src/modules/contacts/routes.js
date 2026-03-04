const express = require('express')
const { validateBody, requiredString } = require('../../middleware/validate')

const router = express.Router()

function validateCreateContact(body) {
  const errors = []
  requiredString(body.fullName, 'fullName', errors)

  if (body.email && typeof body.email !== 'string') {
    errors.push({ field: 'email', message: 'email must be a string' })
  }

  if (body.phone && typeof body.phone !== 'string') {
    errors.push({ field: 'phone', message: 'phone must be a string' })
  }

  return errors
}

function validateUpdateContact(body) {
  const errors = []

  if (!body || Object.keys(body).length === 0) {
    errors.push({ field: 'body', message: 'request body cannot be empty' })
  }

  if (body.fullName !== undefined && typeof body.fullName !== 'string') {
    errors.push({ field: 'fullName', message: 'fullName must be a string' })
  }

  return errors
}

router.get('/', (_req, res) => {
  res.json({ module: 'contacts', status: 'ready' })
})

router.post('/', validateBody(validateCreateContact), (req, res) => {
  res.status(501).json({
    message: 'Create contact endpoint scaffolded',
    payload: req.body,
  })
})

router.patch('/:contactId', validateBody(validateUpdateContact), (req, res) => {
  res.status(501).json({
    message: 'Update contact endpoint scaffolded',
    contactId: req.params.contactId,
    payload: req.body,
  })
})

module.exports = router
