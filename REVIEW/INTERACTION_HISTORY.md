# Interaction History Task Review

## Summary

Completed all Interaction History frontend tasks and all Interaction History backend tasks.

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

## File Type Rundown (What was created/updated)

- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — new per-contact timeline UI and contact fetch wiring.
- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — interaction entry form (type/date/notes), validation, and in-page timeline insertion logic.
- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — quick filters by interaction type and date range, including reset behavior.
- `greenfn-web/src/pages/InteractionHistoryPage.tsx` — related next-step task links rendered per interaction entry.
- `greenfn/src/modules/interactions/routes.js` — interaction CRUD/list routes plus validation limits and summary link/unlink support.
- `TASKS.md` — all Interaction History frontend and backend tasks marked complete.
- `REVIEW/INTERACTION_HISTORY.md` — reproducible review and validation notes for this task.
- `REVIEW/README.md` — review index updated to include this task.
- `LOG.md` — append-only audit entry for this completed batch.
