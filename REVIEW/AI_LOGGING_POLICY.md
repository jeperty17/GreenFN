# AI Logging Policy Review

## Task Summary

Defined and enforced an AI logging policy that minimizes sensitive data retention by logging metadata only (no raw prompt/response text) for summary and draft operations.

## Reproducible Run / Validation Commands

From backend folder:

```bash
cd greenfn
node -e "const { createAIService } = require('./src/modules/ai/service'); console.log(typeof createAIService === 'function' ? 'ok' : 'missing')"
```

If AI key is configured and endpoint wired in later implementation, exercise request paths and inspect backend logs for `[ai]` entries.

## Observable Checks

- Logs include AI lifecycle events for start/success/failure.
- Logged fields include model/provider/status/duration/usage and text length metadata.
- Content identifiers are hashed (`contactIdHash`, `contactNameHash`, `objectiveHash`).
- Raw user content and generated output are not logged.

## File-Type Purpose Rundown

- `greenfn/src/modules/ai/logging.js` — AI-safe logging helper with sanitization/hashing.
- `greenfn/src/modules/ai/service.js` — AI wrapper logic instrumented with metadata-only event logging.
- `docs/ai-logging-policy.md` — policy definition, event list, and validation checklist.
