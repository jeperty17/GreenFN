const crypto = require('crypto')

function toSafeHash(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null
  }

  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function sanitizeMetadata(metadata = {}) {
  const {
    inputText,
    outputText,
    contactId,
    contactName,
    objective,
    sourceMode,
    model,
    provider,
    statusCode,
    durationMs,
    usage,
    errorMessage,
    path,
    ...rest
  } = metadata

  return {
    ...rest,
    provider: provider || null,
    model: model || null,
    path: path || null,
    sourceMode: sourceMode || null,
    statusCode: statusCode || null,
    durationMs: Number.isFinite(durationMs) ? Number(durationMs.toFixed(1)) : null,
    contactIdHash: toSafeHash(contactId),
    contactNameHash: toSafeHash(contactName),
    objectiveHash: toSafeHash(objective),
    inputChars: typeof inputText === 'string' ? inputText.length : 0,
    outputChars: typeof outputText === 'string' ? outputText.length : 0,
    usage: usage || null,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null,
  }
}

function logAIEvent(level, event, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...sanitizeMetadata(metadata),
  }

  if (level === 'error') {
    console.error('[ai]', JSON.stringify(entry))
    return
  }

  if (level === 'warn') {
    console.warn('[ai]', JSON.stringify(entry))
    return
  }

  console.info('[ai]', JSON.stringify(entry))
}

module.exports = {
  logAIEvent,
  sanitizeMetadata,
}
