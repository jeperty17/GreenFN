const DEFAULT_API_BASE_URL = 'http://localhost:3000'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL

export const API_BASE_URL = normalizeBaseUrl(configuredApiBaseUrl)
