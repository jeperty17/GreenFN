const readRequiredEnv = (name) => {
  const value = process.env[name]

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const readOptionalEnv = (name, fallbackValue = '') => {
  const value = process.env[name]

  if (!value || value.trim() === '') {
    return fallbackValue
  }

  return value
}

const PORT = Number(process.env.PORT || 3000)
const NODE_ENV = process.env.NODE_ENV || 'development'

const DATABASE_URL = readRequiredEnv('DATABASE_URL')
const DIRECT_URL = readRequiredEnv('DIRECT_URL')

const AI_PROVIDER = readOptionalEnv('AI_PROVIDER', 'openai')
const AI_PRIMARY_MODEL = readOptionalEnv('AI_PRIMARY_MODEL', 'gpt-4.1-mini')
const AI_FALLBACK_MODEL = readOptionalEnv('AI_FALLBACK_MODEL', 'gpt-4.1-nano')
const OPENAI_API_KEY = readOptionalEnv('OPENAI_API_KEY')
const CORS_ALLOWED_ORIGINS_RAW = readOptionalEnv(
  'CORS_ALLOWED_ORIGINS',
  'http://localhost:5173,https://greenfn-web.vercel.app'
)

const CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS_RAW.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function requireOpenAIApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY')
  }

  return OPENAI_API_KEY
}

module.exports = {
  PORT,
  NODE_ENV,
  DATABASE_URL,
  DIRECT_URL,
  AI_PROVIDER,
  AI_PRIMARY_MODEL,
  AI_FALLBACK_MODEL,
  OPENAI_API_KEY,
  CORS_ALLOWED_ORIGINS,
  requireOpenAIApiKey,
}
