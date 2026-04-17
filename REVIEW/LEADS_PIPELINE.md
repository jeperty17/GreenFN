# Leads Pipeline

## Task Summary

Completed the missing operational pieces for Leads Pipeline by tightening stage transition reliability and backend governance.

## Completed Items

- Added robust frontend error parsing for nested API error shapes in pipeline transition flows.
- Added backend stage transition guardrails for default stage names (for example: terminal stage restrictions and invalid transition rejection).
- Added backend follow-up suggestion trigger emission on successful stage changes via `followUpSuggestion` response payload.
- Added stage transition audit table (`PipelineStageTransition`) with migration and transition write path on stage updates.
- Confirmed structured stage transition logging is active through middleware operation recording plus explicit pipeline transition logs.

## Reproducible Validation Commands

### 1. Validate backend route syntax

```bash
cd greenfn && node --check src/modules/pipeline/routes.js
```

Expected: No syntax errors.

### 2. Validate Prisma schema

```bash
cd greenfn && npx prisma validate
```

Expected: Prisma schema is valid.

### 3. Verify transition history migration exists

```bash
ls -la greenfn/prisma/migrations/20260417162000_pipeline_stage_transition_history/migration.sql
```

Expected: File exists.

### 4. Verify transition guardrails and trigger fields are wired

```bash
grep -n "assertValidStageTransition\|followUpSuggestion\|stage_transition_succeeded\|PipelineStageTransition" greenfn/src/modules/pipeline/routes.js
```

Expected: Matches found for guardrail checks, suggestion payload, transition logging, and transition history persistence.

### 5. Verify frontend nested error parsing

```bash
grep -n "payload\.error\.message\|payload\.error\.details" greenfn-web/src/pages/LeadsPipelinePage.tsx
```

Expected: Matches found in `getApiErrorMessage`.

## Observable Checks

1. Drag a lead from one stage to another.
2. Complete or skip modal steps.
3. Confirm successful transition and suggestion metadata returned by backend.
4. Attempt an invalid transition (for default stages) and confirm `422 Invalid stage transition` behavior.

## File-Type Purpose Rundown

- `greenfn/src/modules/pipeline/routes.js`: Pipeline read/write APIs, transition guardrails, suggestion emission, and audit writes.
- `greenfn/prisma/schema.prisma`: Data model definitions including `PipelineStageTransition`.
- `greenfn/prisma/migrations/20260417162000_pipeline_stage_transition_history/migration.sql`: Additive DB migration for transition history table.
- `greenfn-web/src/pages/LeadsPipelinePage.tsx`: Frontend drag-and-drop orchestration and user-facing transition error handling.
