const readRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const readOptionalEnv = (name, fallbackValue = "") => {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    return fallbackValue;
  }

  return value;
};

const readOptionalInt = (name, fallbackValue) => {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    return fallbackValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
};

function normalizeApiBasePath(value) {
  const rawValue = String(value || "/api").trim();
  const withLeadingSlash = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
  const normalizedPath = withLeadingSlash.replace(/\/+$/, "");
  return normalizedPath.length > 0 ? normalizedPath : "/api";
}

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";
const API_BASE_PATH = normalizeApiBasePath(
  readOptionalEnv("API_BASE_PATH", "/api"),
);

const DATABASE_URL = readRequiredEnv("DATABASE_URL");
const DIRECT_URL = readRequiredEnv("DIRECT_URL");

const AI_PROVIDER = readOptionalEnv("AI_PROVIDER", "openai");
const AI_PRIMARY_MODEL = readOptionalEnv("AI_PRIMARY_MODEL", "gpt-4.1-mini");
const AI_FALLBACK_MODEL = readOptionalEnv("AI_FALLBACK_MODEL", "gpt-4.1-nano");
const OPENAI_API_KEY = readOptionalEnv("OPENAI_API_KEY");
const AUTH_LOGIN_EMAIL = readOptionalEnv(
  "AUTH_LOGIN_EMAIL",
  "advisor.seed@greenfn.local",
);
const AUTH_LOGIN_PASSWORD = readOptionalEnv(
  "AUTH_LOGIN_PASSWORD",
  "password123",
);
const JWT_ACCESS_SECRET = readOptionalEnv(
  "JWT_ACCESS_SECRET",
  "dev-insecure-jwt-secret-change-me",
);
const JWT_ACCESS_EXPIRES_IN = readOptionalEnv("JWT_ACCESS_EXPIRES_IN", "15m");
const AI_TIMEOUT_MS = readOptionalInt("AI_TIMEOUT_MS", 12000);
const AI_RATE_LIMIT_WINDOW_MS = readOptionalInt(
  "AI_RATE_LIMIT_WINDOW_MS",
  60000,
);
const AI_RATE_LIMIT_MAX_REQUESTS = readOptionalInt(
  "AI_RATE_LIMIT_MAX_REQUESTS",
  20,
);
const CORS_ALLOWED_ORIGINS_RAW = readOptionalEnv(
  "CORS_ALLOWED_ORIGINS",
  "http://localhost:5173,https://greenfn-web.vercel.app",
);

const CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS_RAW.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function requireOpenAIApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  return OPENAI_API_KEY;
}

module.exports = {
  PORT,
  NODE_ENV,
  API_BASE_PATH,
  DATABASE_URL,
  DIRECT_URL,
  AI_PROVIDER,
  AI_PRIMARY_MODEL,
  AI_FALLBACK_MODEL,
  OPENAI_API_KEY,
  AUTH_LOGIN_EMAIL,
  AUTH_LOGIN_PASSWORD,
  JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  AI_TIMEOUT_MS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_RATE_LIMIT_MAX_REQUESTS,
  CORS_ALLOWED_ORIGINS,
  requireOpenAIApiKey,
};
