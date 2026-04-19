# AI Service Wrapper (Templates, Retries, Token/Cost Controls)

## Goal

Provide a reusable backend AI wrapper that centralizes:

- prompt template construction,
- retry behavior for transient provider failures,
- input/token/cost guardrails.

## Implementation

File: `greenfn/src/modules/ai/service.js`

Exports:

- `createAIService(config)`
- `buildSummaryMessages(...)`
- `buildDraftMessages(...)`
- `estimateTokenCount(text)`
- `estimateCostUsd({ model, inputTokens, outputTokens })`

## Included controls

- Input-size control via `maxInputChars` (`413` if exceeded).
- Retry policy for `408`, `409`, `429`, and `5xx` provider responses.
- Exponential backoff (`retryBackoffMs * 2^attempt`).
- Primary/fallback model path for summary generation.
- Rough token and cost estimation metadata in responses.

## Prompt templates

- Summary template for `POST /api/ai/summaries` use case.
- Drafting template for follow-up message generation use case.

## Runtime requirements

- Backend env vars from previous steps:
  - `AI_PROVIDER`
  - `AI_PRIMARY_MODEL`
  - `AI_FALLBACK_MODEL`
  - `GEMINI_API_KEY`
- Provider calls require `requireGeminiApiKey()` at call time.

## Scope boundaries

- This step implements wrapper mechanics only.
- AI logging policy is tracked separately in the next checklist item.
