const express = require('express')
const { validateBody, requiredString } = require('../../middleware/validate')

const router = express.Router()

function validateCreateTask(body) {
  const errors = []
  requiredString(body.contactId, 'contactId', errors)
  requiredString(body.title, 'title', errors)
  return errors
}

function validateUpdateTask(body) {
  const errors = []

  if (!body || Object.keys(body).length === 0) {
    errors.push({ field: 'body', message: 'request body cannot be empty' })
  }

  if (body.title !== undefined && typeof body.title !== 'string') {
    errors.push({ field: 'title', message: 'title must be a string' })
  }

  return errors
}

router.get('/', (_req, res) => {
  res.json({ module: 'tasks', status: 'ready' })
})

router.post('/', validateBody(validateCreateTask), (req, res) => {
  res.status(501).json({
    message: 'Create task endpoint scaffolded',
    payload: req.body,
  })
})

router.patch('/:taskId', validateBody(validateUpdateTask), (req, res) => {
  res.status(501).json({
    message: 'Update task endpoint scaffolded',
    taskId: req.params.taskId,
    payload: req.body,
  })
})

module.exports = router
