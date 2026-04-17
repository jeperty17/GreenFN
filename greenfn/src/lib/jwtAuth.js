const jwt = require('jsonwebtoken')
const { JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRES_IN } = require('../config/env')

function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name || null,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  )
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_ACCESS_SECRET)
}

module.exports = {
  issueAccessToken,
  verifyAccessToken,
}
