# AI Secret Handling Task Review

## Summary

This task established backend-only AI API key handling.

- Added AI env variables to backend template (`greenfn/.env.example`).
- Added backend config wiring in `greenfn/src/config/env.js`.
- Added fail-fast helper `requireGeminiApiKey()` for runtime AI calls.
- Confirmed frontend env config remains free of AI secret keys.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn
node -e "const env=require('./src/config/env'); console.log(env.AI_PROVIDER, env.AI_PRIMARY_MODEL, env.AI_FALLBACK_MODEL, !!env.GEMINI_API_KEY);"
```

Expected: provider/model values are resolved; key presence is shown as boolean only.

## Commands to Check Observable Effects

Confirm AI key is backend-only:

```bash
grep -RIn "GEMINI_API_KEY\|AI_PROVIDER\|AI_PRIMARY_MODEL\|AI_FALLBACK_MODEL" greenfn-web || true
grep -n "GEMINI_API_KEY\|AI_PROVIDER\|AI_PRIMARY_MODEL\|AI_FALLBACK_MODEL" greenfn/.env.example
```

Expected:

- No AI secrets in `greenfn-web` files.
- AI env placeholders present in backend `.env.example`.

## File Type Rundown (What was created/updated)

- **Backend env template** (`greenfn/.env.example`): AI provider/model and API key placeholders.
- **Backend env config** (`greenfn/src/config/env.js`): backend-only AI env access and key guard helper.
- **Strategy doc** (`docs/ai-secret-handling.md`): secure handling policy and rollout steps.
- **Tracking files** (`TASKS.md`, `REVIEW/README.md`, `LOG.md`): completion and audit trail.
