# AI API Key Setup (Backend-Only)

## Goal

Configure AI API keys securely in backend environment variables only.

## Environment variables

Set these in `greenfn/.env` (local) and deployment secret manager (prod):

- `AI_PROVIDER` (default: `google`)
- `AI_PRIMARY_MODEL` (default: `gemini-2.5-flash`)
- `AI_FALLBACK_MODEL` (default: `gemini-2.5-flash-lite`)
- `GEMINI_API_KEY` (required at runtime when calling provider)

## Backend-only handling

- Variables are defined in backend config: `greenfn/src/config/env.js`.
- Frontend env (`greenfn-web/.env*`) must not contain AI secret keys.
- `requireGeminiApiKey()` is available for fail-fast validation when AI calls are executed.

## Local setup without real key (current phase)

You can keep `GEMINI_API_KEY` empty while AI provider integration endpoints are still scaffolded.

When ready:

1. Put real key in `greenfn/.env`.
2. Set same key in production secret manager.
3. Do not commit real secrets to git.
