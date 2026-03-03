# TASKS

## SETUP

### React (Vite)
- [ ] Create frontend app with Vite and React.
- [ ] Configure environment variables for API base URL.
- [ ] Set up route structure for Contacts, Pipeline, Today, Interaction History, and AI Summary views.
- [ ] Add shared layout (sidebar/top navigation) for all core pages.

### ShadCN + Tailwind
- [ ] Install and initialize Tailwind CSS.
- [ ] Install and initialize ShadCN UI in the frontend project.
- [ ] Define and document reusable UI primitives (cards, forms, tables, dialogs, badges, toasts).
- [ ] Set up consistent spacing, typography, and state styles for form-heavy workflows.

### Node.js + Express.js
- [ ] Initialize Express backend with TypeScript/JavaScript project structure.
- [ ] Add middleware for CORS, JSON parsing, request logging, and centralized error handling.
- [ ] Define API module boundaries for contacts, pipeline, tasks, interactions, AI, and auth.
- [ ] Add request validation layer for all write endpoints.

### PostgreSQL (Supabase)
- [ ] Create Supabase project and development database.
- [ ] Configure database connection string and secure environment variable handling.
- [ ] Decide and document auth approach (Supabase Auth vs custom JWT with user table).
- [ ] Enable row-level security strategy aligned with per-advisor data isolation.

### Prisma ORM
- [ ] Define initial Prisma schema models and relationships.
- [ ] Generate Prisma client and set up migration workflow.
- [ ] Seed baseline pipeline stages and test data for local development.
- [ ] Add Prisma error mapping strategy for API-friendly responses.

### AI Provider Integration
- [ ] Select AI provider and model(s) for summarization and drafting.
- [ ] Set up API keys and backend-only secret handling.
- [ ] Create a service wrapper for prompt templates, retries, and token/cost controls.
- [ ] Define logging policy for AI inputs/outputs that avoids storing sensitive raw text unnecessarily.

### Deployment (Vercel + Render/Railway)
- [ ] Create Vercel project for frontend deployment.
- [ ] Create Render or Railway service for backend deployment.
- [ ] Set production environment variables for frontend, backend, database, and AI provider.
- [ ] Configure CORS allowlist for production frontend domain.
- [ ] Set up CI/CD from main branch with preview deployments.

---

## IMPLEMENTATION

## Contacts Hub

### FRONTEND
- [ ] Build Contacts Hub page with list/table view for leads and clients.
- [ ] Build create/edit contact form with fields for name, phone, email, type, source, birthday, priorities, and optional portfolio summary.
- [ ] Implement search by name/contact details.
- [ ] Implement filters by lead/client type and acquisition source.
- [ ] Implement tag creation, assignment, and star/focus marker UI.

### BACKEND
- [ ] Implement contacts CRUD endpoints.
- [ ] Implement search and filtering endpoints for type, source, tags, and starred contacts.
- [ ] Implement input validation and normalization for contact fields.
- [ ] Implement pagination and sorting for large contact lists.

### DB
- [ ] Create tables/models for users, contacts, tags, and contact-tag mappings.
- [ ] Add enums for contact type (Lead/Client) and source categories.
- [ ] Add indexes for searchable fields (name, email, phone, source).
- [ ] Add nullable fields for optional portfolio/policy metadata and life priorities.

### DEPLOYMENT
- [ ] Configure production-safe API route prefixing for contacts endpoints.
- [ ] Add monitoring for contacts API latency and error rates.
- [ ] Run migration and seed checks in staging before production rollout.

## Leads Pipeline

### FRONTEND
- [ ] Build kanban board with pipeline columns (New, Contacted, Booked, No-show, In Progress, Closed Won, Closed Lost).
- [ ] Render each lead as a draggable card with key contact details.
- [ ] Implement drag-and-drop status changes with optimistic UI updates.
- [ ] Show visual feedback and error recovery when status update fails.

### BACKEND
- [ ] Implement endpoint to fetch pipeline grouped by stage.
- [ ] Implement endpoint to update lead stage with transition timestamp.
- [ ] Implement guardrails for valid stage transitions.
- [ ] Emit follow-up suggestion trigger after stage changes.

### DB
- [ ] Create pipeline stage enum/table and stage order metadata.
- [ ] Add current stage and stage-updated-at fields to contacts/leads.
- [ ] Add stage transition history table for auditability.
- [ ] Seed default stage values for new leads.

### DEPLOYMENT
- [ ] Validate drag-and-drop stage updates in production-like environment.
- [ ] Enable structured logs for stage transition events.
- [ ] Add rollback plan for schema changes affecting stage enums/history.

## To-Do List (Today View)

### FRONTEND
- [ ] Build Today view showing due-today and overdue next steps.
- [ ] Build task creation/edit UI for per-contact next step text and due date.
- [ ] Add quick actions for complete, snooze, and reschedule.
- [ ] Add optional nudge prompt after pipeline stage movement.

### BACKEND
- [ ] Implement CRUD endpoints for next-step tasks.
- [ ] Implement endpoint for Today feed with overdue and due-today grouping.
- [ ] Implement business logic for task state (open/completed/snoozed).
- [ ] Implement reminder/nudge scheduler trigger logic.

### DB
- [ ] Create tasks table linked to contacts and user.
- [ ] Add due-date, status, completed-at, snooze-until, and priority fields.
- [ ] Add indexes for due-date and status queries.
- [ ] Add task activity log table for audit trail.

### DEPLOYMENT
- [ ] Configure scheduled job/worker for reminders and daily task checks.
- [ ] Ensure timezone handling is consistent between frontend and backend.
- [ ] Add alerting for failed scheduled jobs.

## Interaction History

### FRONTEND
- [ ] Build per-contact chronological timeline UI for interaction logs.
- [ ] Build interaction entry form with type, date, and notes.
- [ ] Add quick filters by interaction type and date range.
- [ ] Add link from timeline entries to related next-step tasks.

### BACKEND
- [ ] Implement CRUD endpoints for interaction entries.
- [ ] Implement list endpoint with pagination and sorting by interaction date.
- [ ] Implement validation for interaction type/date and optional notes size limits.
- [ ] Implement linkage support between interactions and generated summaries.

### DB
- [ ] Create interactions table linked to contacts and user.
- [ ] Add enum for interaction type (Call, Meeting, WhatsApp/DM, General Note).
- [ ] Add created-at and interaction-date fields for timeline consistency.
- [ ] Add foreign key to optional AI summary record.

### DEPLOYMENT
- [ ] Verify timeline query performance with realistic data volume.
- [ ] Enable observability for interaction write/read endpoints.
- [ ] Run migration validation for enum and relation changes.

## AI Interaction Summaries

### FRONTEND
- [ ] Build structured post-interaction questionnaire form.
- [ ] Add alternative input modes for pasted meeting summary, unstructured notes, or pasted chat transcript.
- [ ] Build summary preview and edit-before-save workflow.
- [ ] Add explicit user controls to skip AI generation when not needed.

### BACKEND
- [ ] Implement endpoint to generate summary from structured or unstructured input.
- [ ] Implement prompt templates for concise recall-focused summaries.
- [ ] Implement content safety checks and token/length limits.
- [ ] Persist both generated summary and metadata (model, timestamp, source mode).

### DB
- [ ] Create ai_summaries table linked to interactions and contacts.
- [ ] Add fields for input mode, generated summary text, and model metadata.
- [ ] Add retention policy fields and soft-delete support for privacy.
- [ ] Add indexes for per-contact summary retrieval.

### DEPLOYMENT
- [ ] Set production rate limits and timeout strategy for AI endpoints.
- [ ] Add usage/cost monitoring dashboards for AI calls.
- [ ] Add fallback behavior when AI provider is unavailable.

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
