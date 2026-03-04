const express = require('express')
const { validateBody, requiredString } = require('../../middleware/validate')

const router = express.Router()

function validateLogin(body) {
  const errors = []
  requiredString(body.email, 'email', errors)
  requiredString(body.password, 'password', errors)
  return errors
}

router.get('/', (_req, res) => {
  res.json({ module: 'auth', status: 'ready' })
})

router.post('/login', validateBody(validateLogin), (req, res) => {
  res.status(501).json({
    message: 'Auth login endpoint scaffolded',
    payload: req.body,
  })
})

module.exports = router
