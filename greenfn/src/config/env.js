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

function normalizeAiProvider(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  // Backward-compatible alias: legacy deployments may still set AI_PROVIDER=openai.
  if (normalized === "openai") {
    return "google";
  }

  if (normalized === "gemini") {
    return "google";
  }

  return normalized || "google";
}

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

const AI_PROVIDER = normalizeAiProvider(
  readOptionalEnv("AI_PROVIDER", "google"),
);
const AI_PRIMARY_MODEL = readOptionalEnv(
  "AI_PRIMARY_MODEL",
  "gemini-2.5-flash",
);
const AI_FALLBACK_MODEL = readOptionalEnv(
  "AI_FALLBACK_MODEL",
  "gemini-2.5-flash-lite",
);
const GEMINI_API_KEY = readOptionalEnv("GEMINI_API_KEY");
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

function requireGeminiApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing required environment variable: GEMINI_API_KEY");
  }

  return GEMINI_API_KEY;
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
  GEMINI_API_KEY,
  AI_TIMEOUT_MS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_RATE_LIMIT_MAX_REQUESTS,
  CORS_ALLOWED_ORIGINS,
  requireGeminiApiKey,
};
