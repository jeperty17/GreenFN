# Interaction History Task Review

## Summary

Completed all Interaction History frontend tasks, all Interaction History backend tasks, and all Interaction History DB tasks (interaction linkage to user + required interaction type enum categories + timeline consistency date fields + optional AI summary foreign key linkage).

Interaction History deployment validation is complete: timeline query performance, interaction endpoint observability, and migration validation for enum/relation changes have been verified.

Implemented behavior:

- Loads contacts from `GET /api/contacts`.
- Allows selecting a contact from a dropdown.
- Renders a timeline with newest entries first.
- Shows interaction type badges, date/time, and notes content.
- Handles contact loading, error, and empty timeline states.
- Adds an interaction entry form with required fields for type, date/time, and notes.
- Adds submitted interaction entries directly into the selected contact timeline.
- Adds quick filters for interaction type and date range on the timeline panel.
- Adds optional links from timeline entries to related next-step tasks in the Today view.
- Adds backend CRUD routes for interactions: create, read-by-id, update, delete, and a contact-scoped read list.
- Adds interaction list pagination and sorting by interaction date (`occurredAt`) with query-driven controls.
- Adds explicit validation limits for interaction payloads, including optional notes size limits.
- Adds explicit linkage support between interactions and generated summaries using summary link/unlink endpoints.
- Adds direct user linkage on interactions via `advisorId` (schema + migration + create/list/read compatibility updates).
- Adds required interaction type categories (`CALL`, `MEETING`, `WHATSAPP_DM`, `GENERAL_NOTE`) while preserving legacy enum values for compatibility.
- Confirms timeline consistency fields are present on interactions (`createdAt` + interaction date via `occurredAt`) and list sorting uses interaction date first with created date tie-breaker.
- Adds optional foreign-key linkage from interactions to AI summary records via `aiSummaryRecordId`.
- Persists summary-link payloads in both linked `AiSummary` records and legacy `aiSummary` string metadata during compatibility window.
- Resolves interaction response summary payload from linked `AiSummary` records first, with fallback to legacy `aiSummary` payload parsing.
- Adds structured observability logs for all interaction read/write routes with operation name, status code, duration, and endpoint context.

## Commands to Reproduce / Run

Frontend:

```bash
cd greenfn-web
npm install
npm run dev
```

Backend (for contact dropdown data):

```bash
cd greenfn
npm install
npm run dev
```

## Commands to Check Route/Effect Outcomes

Open Interaction History page:

```bash
open http://localhost:5173/interaction-history
```

Optional backend check for contact source data:

```bash
curl -i "http://localhost:3000/api/contacts?page=1&pageSize=50"
```

Backend interaction CRUD checks (replace IDs with real values from your environment):

```bash
curl -i -X POST "http://localhost:3000/api/interactions" \
	-H "Content-Type: application/json" \
	-d '{"contactId":"<contact-id>","type":"CALL","occurredAt":"2026-04-13T09:30:00.000Z","notes":"Initial discovery call"}'

curl -i "http://localhost:3000/api/interactions?contactId=<contact-id>"

curl -i "http://localhost:3000/api/interactions?contactId=<contact-id>&page=1&pageSize=10&sortDirection=desc"

curl -i "http://localhost:3000/api/interactions/<interaction-id>"

curl -i -X PATCH "http://localhost:3000/api/interactions/<interaction-id>" \
	-H "Content-Type: application/json" \
	-d '{"notes":"Updated interaction notes"}'

curl -i -X POST "http://localhost:3000/api/interactions" \
	-H "Content-Type: application/json" \
	-d '{"contactId":"<contact-id>","type":"CALL","occurredAt":"2026-04-13T09:30:00.000Z","notes":"<string-longer-than-4000-chars>"}'

curl -i -X DELETE "http://localhost:3000/api/interactions/<interaction-id>"

curl -i -X POST "http://localhost:3000/api/interactions/<interaction-id>/summary-link" \
	-H "Content-Type: application/json" \
	-d '{"summaryText":"Client wants a term + ILP blend.","model":"gpt-4.1-mini","sourceMode":"notes","generatedAt":"2026-04-14T00:30:00.000Z"}'

curl -i -X DELETE "http://localhost:3000/api/interactions/<interaction-id>/summary-link"

cd greenfn
npx prisma validate
npm run prisma:generate
npm run prisma:migrate:status
node -e "require('./src/modules/interactions/routes')"

# Ensure migrations are applied for runtime parity.
npm run prisma:migrate:deploy

# Performance validation (seeds to 5000 interactions for one contact if needed,
# then runs repeated timeline-query benchmarks for page sizes 20/50/100).
node ./scripts/benchmark-interactions-timeline.js

# Query plan evidence for timeline query shape.
node ./scripts/explain-interactions-timeline.js

# Interaction endpoint observability sanity check.
node -e "require('./src/modules/interactions/routes')"

# Final migration validation for enum and relation changes.
npx prisma validate
npm run prisma:migrate:status
node -e "require('dotenv').config(); const {Client}=require('pg'); (async()=>{const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); const enumRows=await c.query(\"SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='InteractionType' ORDER BY e.enumsortorder\"); const fkRows=await c.query(\"SELECT conname FROM pg_constraint WHERE conname IN ('Interaction_advisorId_fkey','Interaction_aiSummaryRecordId_fkey') ORDER BY conname\"); const idxRows=await c.query(\"SELECT indexname FROM pg_indexes WHERE tablename='Interaction' AND indexname IN ('Interaction_advisorId_idx','Interaction_aiSummaryRecordId_idx','Interaction_contactId_occurredAt_idx') ORDER BY indexname\"); console.log(JSON.stringify({enumLabels: enumRows.rows.map(r=>r.enumlabel), foreignKeys: fkRows.rows.map(r=>r.conname), indexes: idxRows.rows.map(r=>r.indexname)}, null, 2)); await c.end();})().catch(e=>{console.error(e); process.exit(1);});"
```

Expected:

- Contact selector is populated when contacts API is available.
- Selecting a contact updates the visible timeline.
- Entries are ordered by latest interaction date first.
- UI shows appropriate empty/error feedback when data is missing or request fails.
- Submitting interaction form with valid type/date/notes adds a new entry at the top of the timeline.
- Submitting with missing fields shows inline validation feedback.
- Applying type/date filters narrows visible timeline entries immediately.
- Resetting filters restores the full per-contact timeline list.
- Timeline entries with related tasks show a clickable `View task` link to `/today` with task/contact query parameters.
- Interaction CRUD routes return `201` for create, `200` for read/update, and `204` for delete.
- Interaction list endpoint returns paginated payload metadata and sort metadata (`field=occurredAt`, `direction=asc|desc`).
- Interaction create/update validation rejects notes beyond 4000 characters with a `400 Validation failed` response.
- Summary linkage endpoint attaches generated summary metadata to interaction records and returns linked summary data in response payload.
- Summary unlink endpoint clears the interaction-summary link with `204` response.
- New interaction records include direct user linkage (`advisorId`) and existing records remain readable via compatibility scoping.
- Backend accepts both required and legacy interaction enum values during compatibility window.
- Interaction records expose both `occurredAt` (interaction date) and `createdAt` for timeline consistency requirements.
- Interaction-summary linking now also sets optional `aiSummaryRecordId` foreign key to a linked `AiSummary` row.
- Summary-link updates modify the existing linked `AiSummary` record when present, otherwise create and link a new record.
- Summary-unlink clears both legacy `aiSummary` content and the `aiSummaryRecordId` relation on `Interaction`.
- Migration/benchmark checks require local Supabase services to be running (`supabase status` healthy and Docker daemon available).
- Timeline query performance was validated against 5,000 interactions on one contact:
  - pageSize 20: avg 2.91 ms, p95 5.63 ms
  - pageSize 50: avg 2.93 ms, p95 5.58 ms
  - pageSize 100: avg 3.01 ms, p95 4.27 ms
- `EXPLAIN (ANALYZE, BUFFERS)` confirms index usage on `Interaction_contactId_occurredAt_idx` with measured execution time around 0.257 ms for `LIMIT 100` timeline query shape.
- Interaction read/write endpoints emit structured logs prefixed with `[interactions]` and JSON metadata including `operation`, `endpointType`, `statusCode`, `durationMs`, and hashed entity identifiers.
- Final migration validation passed with database schema up to date, required enum labels present (`WHATSAPP_DM`, `GENERAL_NOTE`), required foreign keys present (`Interaction_advisorId_fkey`, `Interaction_aiSummaryRecordId_fkey`), and required indexes present (`Interaction_advisorId_idx`, `Interaction_aiSummaryRecordId_idx`, `Interaction_contactId_occurredAt_idx`).

## File Type Rundown (What was created/updated)

- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — new per-contact timeline UI and contact fetch wiring.
- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — interaction entry form (type/date/notes), validation, and in-page timeline insertion logic.
- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — quick filters by interaction type and date range, including reset behavior.
- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — related next-step task links rendered per interaction entry.
- `greenfn/src/modules/interactions/routes.js` — interaction CRUD/list routes plus validation limits and summary link/unlink support.
- `greenfn/prisma/schema.prisma` — `Interaction` now includes optional `advisorId` relation to `User`.
- `greenfn/prisma/migrations/20260414214000_interaction_add_advisor_link/migration.sql` — additive migration to add/backfill/index/foreign-key `advisorId` on `Interaction`.
- `greenfn/prisma/migrations/20260414220500_interaction_type_enum_add_required_values/migration.sql` — additive enum migration adding `WHATSAPP_DM` and `GENERAL_NOTE` values.
- `greenfn/prisma/schema.prisma` — `Interaction` now includes optional `aiSummaryRecordId` relation to `AiSummary`; new `AiSummary` model added.
- `greenfn/prisma/migrations/20260415091500_interaction_add_ai_summary_fk/migration.sql` — additive migration creating `AiSummary` table and optional foreign key/index on `Interaction.aiSummaryRecordId`.
- `greenfn/src/modules/interactions/routes.js` — interaction create/list/read logic updated for direct `advisorId` linkage with backward-compatible access checks.
- `greenfn/src/modules/interactions/routes.js` — interaction type validation updated to accept new required categories with backward compatibility.
- `greenfn/src/modules/interactions/routes.js` — summary-link endpoints and interaction mapping updated to persist/read linked AI summary records while preserving legacy summary metadata compatibility.
- `greenfn/src/modules/interactions/logging.js` — structured observability helper for interaction endpoint telemetry (level mapping, metadata sanitation, and hashed identifiers).
- `greenfn/src/modules/interactions/routes.js` — interaction endpoint observability wiring with per-route operation annotations for read/write traffic.
- `greenfn/scripts/benchmark-interactions-timeline.js` — reproducible realistic-load benchmark for timeline query latency.
- `greenfn/scripts/explain-interactions-timeline.js` — reproducible EXPLAIN ANALYZE runner for timeline query plan evidence.
- `TASKS.md` — all Interaction History frontend and backend tasks marked complete.
- `TASKS.md` — all Interaction History DB tasks marked complete.
- `TASKS.md` — first Interaction History deployment task (timeline query performance verification) marked complete.
- `TASKS.md` — all Interaction History deployment tasks marked complete.
- `REVIEW/INTERACTION_HISTORY.md` — reproducible review and validation notes for this task.
- `REVIEW/README.md` — review index updated to include this task.
- `LOG.md` — append-only audit entry for this completed batch.
