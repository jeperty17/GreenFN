# TASKS

## SETUP

### React (Vite)

- [x] Create frontend app with Vite and React.
- [x] Configure environment variables for API base URL.
- [x] Set up route structure for Contacts, Pipeline, Today, Interaction History, and AI Summary views.
- [x] Add shared layout (sidebar/top navigation) for all core pages.

### ShadCN + Tailwind

- [x] Install and initialize Tailwind CSS.
- [x] Install and initialize ShadCN UI in the frontend project.
- [x] Define and document reusable UI primitives (cards, forms, tables, dialogs, badges, toasts).
- [x] Set up consistent spacing, typography, and state styles for form-heavy workflows.

### Node.js + Express.js

- [x] Initialize Express backend with TypeScript/JavaScript project structure.
- [x] Add middleware for CORS, JSON parsing, request logging, and centralized error handling.
- [x] Define API module boundaries for contacts, pipeline, tasks, interactions, AI, and auth.
- [x] Add request validation layer for all write endpoints.

### PostgreSQL (Supabase)

- [x] Create Supabase project and development database.
- [x] Configure database connection string and secure environment variable handling.
- [x] Decide and document auth approach (Supabase Auth vs custom JWT with user table).
- [x] Enable row-level security strategy aligned with per-advisor data isolation.

### Prisma ORM

- [x] Define initial Prisma schema models and relationships.
- [x] Generate Prisma client and set up migration workflow.
- [x] Seed baseline pipeline stages and test data for local development.
- [x] Add Prisma error mapping strategy for API-friendly responses.

### AI Provider Integration

- [x] Select AI provider and model(s) for summarization and drafting.
- [x] Set up API keys and backend-only secret handling.
- [x] Create a service wrapper for prompt templates, retries, and token/cost controls.
- [x] Define logging policy for AI inputs/outputs that avoids storing sensitive raw text unnecessarily.

### Deployment (Vercel + Render/Railway)

- [x] Create Vercel project for frontend deployment.
- [x] Create Render or Railway service for backend deployment.
- [x] Set production environment variables for frontend, backend, database, and AI provider.
- [x] Configure CORS allowlist for production frontend domain.
- [x] Set up CI/CD from main branch with preview deployments.

---

## IMPLEMENTATION

## Contacts Hub

### FRONTEND

- [x] Build Contacts Hub page with list/table view for leads and clients.
- [x] Build create/edit contact form with fields for name, phone, email, type, source, birthday, priorities, and optional portfolio summary.
- [x] Implement search by name/contact details.
- [x] Implement filters by lead/client type and acquisition source.
- [x] Implement tag creation, assignment, and star/focus marker UI.

### BACKEND

- [x] Implement contacts CRUD endpoints.
- [x] Implement search and filtering endpoints for type, source, tags, and starred contacts.
- [x] Implement input validation and normalization for contact fields.
- [x] Implement pagination and sorting for large contact lists.

### DB

- [x] Create tables/models for users, contacts, tags, and contact-tag mappings.
- [x] Add enums for contact type (Lead/Client) and source categories.
- [x] Add indexes for searchable fields (name, email, phone, source).
- [x] Add nullable fields for optional portfolio/policy metadata and life priorities.

### DEPLOYMENT

- [x] Configure production-safe API route prefixing for contacts endpoints.
- [x] Add monitoring for contacts API latency and error rates.
- [ ] Run migration and seed checks in staging before production rollout.

## Leads Pipeline

### FRONTEND

- [x] Build kanban board with pipeline columns (New, Contacted, Booked, No-show, In Progress, Closed Won, Closed Lost).
- [x] Render each lead as a draggable card with key contact details.
- [x] Implement drag-and-drop status changes with optimistic UI updates.
- [x] Show visual feedback and error recovery when status update fails.

### BACKEND

- [x] Implement endpoint to fetch pipeline grouped by stage.
- [x] Implement endpoint to update lead stage with transition timestamp.
- [x] Implement guardrails for valid stage transitions.
- [x] Emit follow-up suggestion trigger after stage changes.

### DB

- [x] Create pipeline stage enum/table and stage order metadata.
- [x] Add current stage and stage-updated-at fields to contacts/leads.
- [x] Add stage transition history table for auditability.
- [x] Seed default stage values for new leads.

### DEPLOYMENT

- [ ] Validate drag-and-drop stage updates in production-like environment.
- [x] Enable structured logs for stage transition events.
- [ ] Add rollback plan for schema changes affecting stage enums/history.

## To-Do List (Today View)

### FRONTEND

- [x] Build Today view showing due-today and overdue next steps.
- [x] Build task creation/edit UI for per-contact next step text and due date.
- [x] Add quick actions for complete, snooze, and reschedule.
- [x] Add optional nudge prompt after pipeline stage movement.

### BACKEND

- [x] Implement CRUD endpoints for next-step tasks.
- [x] Implement endpoint for Today feed with overdue and due-today grouping.
- [x] Implement business logic for task state (open/completed/snoozed).
- [ ] Implement reminder/nudge scheduler trigger logic.

### DB

- [x] Create tasks table linked to contacts and user.
- [x] Add due-date, status, completed-at fields.
- [x] Add indexes for due-date and status queries.
- [ ] Add task activity log table for audit trail.

### DEPLOYMENT

- [ ] Configure scheduled job/worker for reminders and daily task checks.
- [x] Ensure timezone handling is consistent between frontend and backend.
- [ ] Add alerting for failed scheduled jobs.

## Interaction History

### FRONTEND

- [x] Build per-contact chronological timeline UI for interaction logs.
- [x] Build interaction entry form with type, date, and notes.
- [x] Add quick filters by interaction type and date range.
- [x] Add link from timeline entries to related next-step tasks.

### BACKEND

- [x] Implement CRUD endpoints for interaction entries.
- [x] Implement list endpoint with pagination and sorting by interaction date.
- [x] Implement validation for interaction type/date and optional notes size limits.
- [x] Implement linkage support between interactions and generated summaries.

### DB

- [x] Create interactions table linked to contacts and user.
- [x] Add enum for interaction type (Call, Meeting, WhatsApp/DM, General Note).
- [x] Add created-at and interaction-date fields for timeline consistency. //check this next time
- [x] Add foreign key to optional AI summary record. //this as well

### DEPLOYMENT

- [x] Verify timeline query performance with realistic data volume.
- [x] Enable observability for interaction write/read endpoints.
- [x] Run migration validation for enum and relation changes.

## AI Interaction Summaries

### FRONTEND

- [x] Build structured post-interaction questionnaire form.
- [x] Add alternative input modes for pasted meeting summary, unstructured notes, or pasted chat transcript.
- [x] Build summary preview and edit-before-save workflow.
- [x] Add explicit user controls to skip AI generation when not needed.

### BACKEND

- [x] Implement endpoint to generate summary from structured or unstructured input.
- [x] Implement prompt templates for concise recall-focused summaries.
- [x] Implement content safety checks and token/length limits.
- [x] Persist both generated summary and metadata (model, timestamp, source mode).

### DB

- [x] Create ai_summaries table linked to interactions and contacts.
- [x] Add fields for input mode, generated summary text, and model metadata.
- [x] Add retention policy fields and soft-delete support for privacy.
- [x] Add indexes for per-contact summary retrieval.nmbnv

### DEPLOYMENT

- [x] Set production rate limits and timeout strategy for AI endpoints.
- [x] Add usage/cost monitoring dashboards for AI calls.
- [x] Add fallback behavior when AI provider is unavailable.

## Assisted Messaging for Next Steps (Extension)

### FRONTEND

- [ ] Build message draft panel triggered from due message-related tasks.
- [ ] Build editable template system with placeholders.
- [ ] Add one-click copy and deep-link/open-external-app actions.
- [ ] Show clear user confirmation that final send happens outside GreenFN.

### BACKEND

- [ ] Implement draft generation endpoint using contact, stage, and recent interactions.
- [ ] Implement CRUD endpoints for user-defined message templates.
- [ ] Implement placeholder interpolation service for templates.
- [ ] Add feature flag to enable/disable this extension.

### DB

- [ ] Create message_templates table linked to user.
- [ ] Create generated_message_drafts table linked to tasks/contacts.
- [ ] Add audit fields for draft generation and edits.
- [ ] Add indexes for template lookup by category/use case.

### DEPLOYMENT

- [ ] Configure feature-flag settings per environment.
- [ ] Track draft generation success/failure metrics.
- [ ] Add compliance note in production release checklist for non-automated messaging design.

## Conversation State Tracking (Extension)

### FRONTEND

- [ ] Add conversation state selector to relevant task/contact workflows.
- [ ] Surface open communication loops prominently in Today view.
- [ ] Add prompts for users to update conversation state daily.
- [ ] Add filters to isolate contacts with unresolved loops.

### BACKEND

- [ ] Implement endpoints to set and update conversation states.
- [ ] Implement unresolved-loop query for Today prioritization.
- [ ] Implement simple reminders for stale states requiring user update.
- [ ] Add reporting endpoint for count of open loops by state.

### DB

- [ ] Create conversation_loops table linked to contacts and initiating tasks.
- [ ] Add enum for states (Awaiting Response, In Progress, Response Received, Closed).
- [ ] Add last-updated and next-review date fields.
- [ ] Add indexes for unresolved state queries.

### DEPLOYMENT

- [ ] Enable scheduler support for stale-loop reminder jobs.
- [ ] Monitor unresolved-loop query performance in production.
- [ ] Add release verification checklist for state transitions and reminders.

---

## Scope Notes

- [ ] Keep Simple Pipeline Insights excluded for MVP (as per proposal guidance).
- [ ] Treat Assisted Messaging and Conversation State Tracking as extensions behind feature flags until core features are stable.
