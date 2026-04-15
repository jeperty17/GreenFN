const MAX_OPERATIONS = 120

const operations = []

function mapMethodToCrud(method) {
  const normalizedMethod = String(method || '').toUpperCase()

  if (normalizedMethod === 'POST') {
    return 'CREATE'
  }

  if (normalizedMethod === 'PATCH' || normalizedMethod === 'PUT') {
    return 'UPDATE'
  }

  if (normalizedMethod === 'DELETE') {
    return 'DELETE'
  }

  return null
}

function mapPathToFeature(pathname) {
  const normalizedPath = String(pathname || '').toLowerCase()

  if (normalizedPath.includes('/contacts')) {
    return 'contacts'
  }

  if (normalizedPath.includes('/pipeline')) {
    return 'pipeline'
  }

  if (normalizedPath.includes('/tasks')) {
    return 'tasks'
  }

  if (normalizedPath.includes('/interactions')) {
    return 'interactions'
  }

  if (normalizedPath.includes('/ai')) {
    return 'ai'
  }

  return 'other'
}

function pushOperation(operation) {
  operations.unshift(operation)

  if (operations.length > MAX_OPERATIONS) {
    operations.length = MAX_OPERATIONS
  }
}

function recordOperation({ method, path, statusCode, durationMs }) {
  const normalizedPath = String(path || '')
  const crud = mapMethodToCrud(method)

  if (!crud) {
    return
  }

  pushOperation({
    method: String(method || '').toUpperCase(),
    crud,
    feature: mapPathToFeature(normalizedPath),
    path: normalizedPath,
    statusCode: Number(statusCode || 0),
    durationMs: Number(durationMs || 0),
    at: new Date().toISOString(),
  })
}

function getRecentOperations(limit = 20) {
  const normalizedLimit = Math.max(1, Number.parseInt(String(limit), 10) || 20)
  return operations.slice(0, normalizedLimit)
}

function getRecentOperationsByFeature(feature, limit = 8) {
  const normalizedFeature = String(feature || '').toLowerCase()
  const normalizedLimit = Math.max(1, Number.parseInt(String(limit), 10) || 8)

  return operations.filter((item) => item.feature === normalizedFeature).slice(0, normalizedLimit)
}

module.exports = {
  recordOperation,
  getRecentOperations,
  getRecentOperationsByFeature,
}
