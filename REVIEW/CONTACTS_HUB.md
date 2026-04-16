# Contacts Hub Task Review

## Summary

This step implemented the initial Contacts Hub read experience end-to-end:

- Backend `GET /api/contacts` now returns real Prisma-backed results.
- The endpoint supports pagination and filtering by search text, contact type, source, and starred status.
- Frontend Contacts Hub now renders a table view for leads/clients with search, filters, loading/error states, and pagination controls.
- Frontend now includes a create/edit contact form for full name, phone, email, type, source, birthday, priorities, optional portfolio summary, and starred marker.
- Backend `POST /api/contacts` and `PATCH /api/contacts/:contactId` now persist normalized contact fields.
- Frontend now supports tag creation, tag assignment/removal per contact row, and direct star/focus marker toggling.
- Backend now supports `GET/POST /api/contacts/tags`, `POST /api/contacts/:contactId/tags`, `DELETE /api/contacts/:contactId/tags/:tagId`, and `PATCH /api/contacts/:contactId/starred`.
- Backend contacts CRUD is now complete with `GET /api/contacts/:contactId` and `DELETE /api/contacts/:contactId` added.

## Commands to Reproduce / Run

Backend:

```bash
cd greenfn
npm install
npm run dev
```

Frontend:

```bash
cd greenfn-web
npm install
npm run dev
```

## Commands to Check Route/Effect Outcomes

Frontend build validation:

```bash
cd greenfn-web
npm run build
```

Backend contacts endpoint smoke checks:

```bash
curl -i "http://localhost:3000/api/contacts?page=1&pageSize=10"
curl -i "http://localhost:3000/api/contacts?search=alice&type=LEAD&source=referral&starred=false&page=1&pageSize=10"
```

Backend write endpoint smoke checks:

```bash
curl -i -X POST "http://localhost:3000/api/contacts" \
	-H "Content-Type: application/json" \
	-d '{"fullName":"Form Test Contact","type":"LEAD","email":"form.test@example.com","source":"Referral","birthday":"1991-06-11","priorities":"Education planning","portfolioSummary":"Existing ILP","isStarred":true}'

curl -i -X PATCH "http://localhost:3000/api/contacts/<contact-id>" \
	-H "Content-Type: application/json" \
	-d '{"type":"CLIENT","source":"Warm referral","priorities":"Retirement first","portfolioSummary":""}'

curl -i -X POST "http://localhost:3000/api/contacts/tags" \
	-H "Content-Type: application/json" \
	-d '{"name":"VIP"}'

curl -i "http://localhost:3000/api/contacts/tags"

curl -i -X POST "http://localhost:3000/api/contacts/<contact-id>/tags" \
	-H "Content-Type: application/json" \
	-d '{"tagIds":["<tag-id>"]}'

curl -i -X PATCH "http://localhost:3000/api/contacts/<contact-id>/starred" \
	-H "Content-Type: application/json" \
	-d '{"isStarred":true}'

curl -i -X DELETE "http://localhost:3000/api/contacts/<contact-id>/tags/<tag-id>"

curl -i "http://localhost:3000/api/contacts/<contact-id>"

curl -i -X DELETE "http://localhost:3000/api/contacts/<contact-id>"
```

Expected:

- JSON payload with `items`, `pagination`, and `filters`.
- `items` entries include `fullName`, `type`, `source`, `email`, `phone`, `isStarred`, and `tags`.

Resolved blocker note:

- Prisma runtime client initialization in `greenfn/src/lib/prisma.js` now uses `@prisma/adapter-pg` with `DATABASE_URL`/`DIRECT_URL` and host-aware SSL behavior.
- This removed the local `P6001` failure observed in earlier smoke tests.

## Observable UI Checks

After starting both apps and opening `http://localhost:5173/`:

- Contacts Hub page shows a table list of contacts.
- Contacts Hub page includes a create/edit form above the table.
- Clicking `Edit` on a row loads that contact into the form and updates it on submit.
- `Tag Management` section allows creating reusable tags.
- Tags can be assigned from the row dropdown and removed by clicking tag chips.
- Focus marker can be toggled directly from the table via `Starred`/`Mark Star` button.
- Search field filters by name/email/phone.
- Type/source/starred filters affect visible rows.
- Tag filter narrows contacts by assigned tag names.
- Previous/Next pagination controls update current page.
- Empty, loading, and error states are visible when appropriate.

## File Type Rundown (What was created/updated)

- **Backend module routing** (`greenfn/src/modules/contacts/routes.js`): added Prisma list query, tag/type/source/star filters, pagination response, create/update endpoints, contact normalization, tag management endpoints, row-level tag assignment/removal, and starred toggle endpoint.
- **Backend module routing** (`greenfn/src/modules/contacts/routes.js`): completed contacts CRUD with list/create/read-by-id/update/delete, plus tag management and starred toggle endpoints; also corrected update flow advisor context selection when handling tagNames.
- **Frontend page component** (`greenfn-web/src/pages/ContactsHubPage.tsx`): implemented list table UI, create/edit contact form, tag management section, row-level tag assignment/removal controls, focus toggle controls, filter/search controls, API wiring, and pagination interactions.
- **Task tracking** (`TASKS.md`): marked completed Contacts Hub frontend checklist items done for this step.
- **Review index** (`REVIEW/README.md`): registered this review file.

---

## DB + Deployment Expansion (Contacts Hub)

### Summary

This step completed the Contacts Hub DB checklist and the first two deployment checklist items with a collision-safe, additive migration approach:

- Added new contacts data fields for source categorization and richer optional profile metadata.
- Added searchable indexes for high-frequency Contacts filters/search dimensions.
- Added a production-safe API base path configuration (`API_BASE_PATH`) so contacts routes can be deployed under configurable prefixes.
- Added contacts-specific structured latency/error logs for read/write endpoint observability.
- Resolved a pre-existing migration replay issue affecting shadow DB by fixing enum type resolution in an Interaction History migration.

### Commands to Reproduce / Validate

Migration creation and apply:

```bash
cd greenfn
npx prisma migrate dev --name contacts_hub_expand_source_category_metadata
```

Schema and migration checks:

```bash
cd greenfn
npx prisma validate
npx prisma migrate status
```

Seed health check:

```bash
cd greenfn
npm run prisma:seed
```

API prefix configuration check:

```bash
# Backend .env example now includes API_BASE_PATH="/api"
# Example custom prefix run:
API_BASE_PATH="/v1" npm run dev
```

### Observable Checks

- Prisma migration status reports database schema up to date after applying Contacts expansion migration.
- Prisma schema validation succeeds with no model/index/type errors.
- Seed script completes successfully after migration changes.
- Contacts route mounting now follows configured API base path from env (default `/api`).
- Contacts endpoint telemetry logs include operation, duration, status code, and hashed identifiers.

### File Type Rundown (DB + Deployment Step)

- **Prisma schema/model contract** (`greenfn/prisma/schema.prisma`): added `ContactSourceCategory`, new optional `Contact` metadata columns, and new query-supporting indexes.
- **Prisma migration SQL** (`greenfn/prisma/migrations/20260415083321_contacts_hub_expand_source_category_metadata/migration.sql`): generated additive migration for enum, columns, and indexes.
- **Prisma migration SQL fix** (`greenfn/prisma/migrations/20260414220500_interaction_type_enum_add_required_values/migration.sql`): corrected enum regtype lookup to support reliable shadow DB replay.
- **Backend env config** (`greenfn/src/config/env.js`): added normalized `API_BASE_PATH` parsing/export.
- **Backend app mount** (`greenfn/src/app.js`): switched API router mount from hardcoded `/api` to configurable `API_BASE_PATH`.
- **Backend env template** (`greenfn/.env.example`): documented `API_BASE_PATH` default.
- **Backend contacts routes** (`greenfn/src/modules/contacts/routes.js`): added source-category and policy metadata support plus metrics middleware wiring.
- **Backend contacts telemetry helper** (`greenfn/src/modules/contacts/logging.js`): new structured logging utility for contacts endpoints.
