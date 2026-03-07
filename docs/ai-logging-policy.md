# AI Logging Policy (Sensitive Data Minimization)

## Goal

Record enough telemetry to monitor AI reliability/cost while avoiding storage of sensitive client text and generated content.

## Policy Rules

1. **Never log raw AI prompt or response text** in backend application logs.
2. Log only metadata needed for operations:
   - event name and timestamp,
   - provider/model,
   - status code (if failed),
   - duration,
   - token/cost estimates,
   - input/output character counts,
   - hashed identifiers for correlating requests (`contactId`, `contactName`, `objective`).
3. Keep failure logs concise; include high-level error message but no user-supplied raw content.
4. Apply the same policy for summary and drafting paths.
5. Any future debug mode that prints raw text must stay disabled by default and require an explicit temporary local-only change.

## Enforced Implementation

- Metadata-only logger helper: `greenfn/src/modules/ai/logging.js`
- Integrated usage points: `greenfn/src/modules/ai/service.js`

## Current Event Types

- `summary_request_started`
- `summary_request_succeeded`
- `summary_primary_failed_using_fallback`
- `summary_request_failed`
- `draft_request_started`
- `draft_request_succeeded`
- `draft_request_failed`

## Validation Checklist

- Trigger AI summary/draft call.
- Confirm logs begin with `[ai]` and JSON payload fields.
- Confirm logs do **not** contain raw prompt/response text.
- Confirm logs include only hashes/counts/usage metadata for user content fields.
