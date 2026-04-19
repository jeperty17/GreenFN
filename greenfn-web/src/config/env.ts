const DEFAULT_API_BASE_URL = "http://localhost:3000";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseApiBaseUrl(url: string): string {
  const normalized = normalizeBaseUrl(url);

  if (!normalized) {
    throw new Error("VITE_API_BASE_URL cannot be empty.");
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error(
      `Invalid VITE_API_BASE_URL: ${url}. Use a full http(s) URL to your deployed API.`,
    );
  }

  return normalized;
}

function resolveApiBaseUrl(): string {
  const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredApiBaseUrl) {
    return parseApiBaseUrl(configuredApiBaseUrl);
  }

  if (import.meta.env.PROD) {
    throw new Error(
      "Missing VITE_API_BASE_URL. Set it in Vercel to your deployed backend URL.",
    );
  }

  return DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
