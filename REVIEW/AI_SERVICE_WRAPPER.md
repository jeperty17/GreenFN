# AI Service Wrapper Task Review

## Summary

This task added an AI service wrapper for prompt templates, retries, and token/cost controls.

- Added wrapper module at `greenfn/src/modules/ai/service.js`.
- Included summary/draft prompt template builders.
- Added retry + backoff behavior for transient provider errors.
- Added input-size, token-estimate, and cost-estimate controls.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn
node -r dotenv/config -e "const ai=require('./src/modules/ai/service'); const svc=ai.createAIService(); const msgs=svc.buildSummaryMessages({contactId:'c1', input:'Client wants retirement planning.'}); console.log(Array.isArray(msgs), msgs.length, ai.estimateTokenCount('hello world') > 0, ai.estimateCostUsd({model:'gpt-4.1-mini', inputTokens:500, outputTokens:300}));"
```

Expected output: `true 2 true 0.00068` (or equivalent numeric formatting).

## Commands to Check Observable Effects

Optional: invoke wrapper methods from future AI routes/services and inspect returned `usage` metadata (`estimatedInputTokens`, `estimatedOutputTokens`, `estimatedCostUsd`).

## File Type Rundown (What was created/updated)

- **Service wrapper** (`greenfn/src/modules/ai/service.js`): templates + retries + token/cost controls.
- **Strategy doc** (`docs/ai-service-wrapper.md`): wrapper behavior and boundaries.
- **Review doc** (`REVIEW/AI_SERVICE_WRAPPER.md`): reproducible checks for this setup item.
- **Tracking files** (`TASKS.md`, `REVIEW/README.md`, `LOG.md`): completion and audit trail.
