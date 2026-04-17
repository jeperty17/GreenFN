const { verifyAccessToken } = require('../lib/jwtAuth')

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '')

  if (!header.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ message: 'Authentication required' })
    return
  }

  const token = header.slice(7).trim()

  if (!token) {
    res.status(401).json({ message: 'Authentication required' })
    return
  }

  try {
    const payload = verifyAccessToken(token)

    if (!payload?.sub || typeof payload.sub !== 'string') {
      res.status(401).json({ message: 'Invalid token' })
      return
    }

    req.authUser = {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      name: typeof payload.name === 'string' ? payload.name : null,
    }

    next()
  } catch (_error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
