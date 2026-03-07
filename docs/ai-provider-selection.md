# AI Provider and Model Selection (MVP)

## Decision

- **Provider:** OpenAI
- **Primary model (summarization + drafting):** `gpt-4.1-mini`
- **Fallback model (degraded mode):** `gpt-4.1-nano`

## Why this choice

- Supports both structured summarization and short-form drafting use cases.
- Balances output quality with latency/cost for an MVP used in frequent advisor workflows.
- Keeps model family consistent between primary/fallback to simplify prompt and response handling.

## Scope boundaries for this step

This step only finalizes provider/model selection.

- API key storage/secret handling is tracked in the next checklist item.
- Service wrapper (prompt templates, retries, token/cost controls) is tracked separately.
- Logging policy for AI I/O is tracked separately.

## Planned usage mapping

- `POST /api/ai/summaries` default model: `gpt-4.1-mini`
- Degraded/fallback path: `gpt-4.1-nano`

## Notes

- Keep provider/model values centralized in backend config when implementing the wrapper.
- Record `model` metadata on generated summaries in the later persistence task.
