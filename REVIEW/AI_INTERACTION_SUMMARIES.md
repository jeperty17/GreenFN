# AI Interaction Summaries — FRONTEND

## Task Summary

Built the structured post-interaction questionnaire form component as the first step of the AI Interaction Summaries feature. The form provides multiple input modes to capture interaction details flexibly, enabling AI-powered summarization workflows.

## Completed Items

- ✅ Created `PostInteractionQuestionnaireForm.tsx` component with 4 input modes:
  - Structured Fields: Manual bullet-point entry for key points, client needs, next steps, and follow-up action
  - Pasted Meeting Summary: Direct paste of a full meeting summary
  - Unstructured Notes: Free-form stream-of-consciousness notes
  - Chat Transcript: Paste chat conversations with platform selector (WhatsApp, SMS, Email, Other)
- ✅ Integrated questionnaire form into `AISummaryPage.tsx`
- ✅ Added contact selector UI to associate interactions with contacts
- ✅ Implemented form validation for each input mode
- ✅ Added mode-specific helper text and UI feedback
- ✅ Completed alternative input modes task for pasted meeting summary, unstructured notes, and chat transcript (all modes implemented and validated in UI)
- ✅ Added summary preview and edit-before-save workflow with:
  - Draft generation from questionnaire input
  - Editable preview textarea before save
  - Save action with validation feedback
  - Back action to return to questionnaire editing
- ✅ Added explicit skip-AI user controls with:
  - Skip action in questionnaire stage
  - Skip action in preview stage
  - Dedicated "AI Generation Skipped" status card
  - Clear options to proceed without AI summary or return to generation
- ✅ Implemented backend AI summary generation endpoint (`POST /api/ai/summaries`) supporting both:
  - Structured source mode payload (`sourceMode: structured` + `structuredInput` fields)
  - Non-structured payload (`sourceMode` + free-text `input`)
  - Endpoint now calls AI service wrapper and returns generated summary text, model, source mode, usage metadata, and timestamp
- ✅ Implemented concise recall-focused prompt templates in AI service with:
  - Mode-aware guidance by source type (`structured`, `pasted-summary`, `unstructured`, `chat-transcript`, `notes`)
  - Explicit output contract (fixed sections, concise bullets, no guessing)
  - Template emphasis injection in summary generation messages
- ✅ Implemented content safety checks and token/length limits in AI service:
  - Blocked-content screening for high-risk categories (self-harm intent, violent threats, sexual-minors content)
  - Input token cap enforcement (`maxInputTokens`) using estimated token count
  - Input character cap enforcement (`maxInputChars`)
  - Output character cap enforcement for summaries and drafts (`maxSummaryOutputChars`, `maxDraftOutputChars`)
  - Non-empty output validation before returning AI responses
- ✅ Implemented backend persistence for generated summaries and metadata:
  - `POST /api/ai/summaries` now stores generated text in `AiSummary`
  - Persists `model`, `sourceMode`, and `generatedAt` fields
  - Returns persisted `summary.id` in response payload
  - Optionally links persisted summary to an interaction when `interactionId` is provided
- ✅ Completed AI summary DB expansion for contact linkage, metadata, retention, and retrieval:
  - Linked `AiSummary` to `Contact` via optional `contactId`
  - Added `inputMode` and `modelMetadata` fields
  - Added retention/soft-delete fields: `retentionUntil`, `deletedAt`
  - Added indexes for per-contact retrieval and retention checks
  - Added additive migration script with backfill for `inputMode` and best-effort `contactId`
- ✅ Set deployment-grade AI endpoint control strategy:
  - Added env-driven AI timeout (`AI_TIMEOUT_MS`) wired into AI service initialization
  - Added env-driven AI rate limiting (`AI_RATE_LIMIT_WINDOW_MS`, `AI_RATE_LIMIT_MAX_REQUESTS`)
  - Enforced per-client in-memory rate limiting on `POST /api/ai/summaries`
  - Returned structured 429 payload on limit breach with retry guidance metadata
- ✅ Added usage/cost monitoring dashboard backend support:
  - Added in-memory AI metrics aggregator for request volume, success/failure counts, estimated token usage, estimated cost, and average latency
  - Added model/path breakdown aggregates and hourly cost/request series
  - Added dashboard-ready endpoint `GET /api/ai/metrics?windowMinutes=<int>`
- ✅ Added provider-unavailable fallback behavior for AI summaries:
  - Added route-level degraded fallback when AI provider is unavailable (timeouts, upstream 5xx/429, or missing key)
  - Added local deterministic summary generation with consistent sectioned output contract
  - Added fallback metadata in persisted/response model metadata (`provider`, `degraded`, `fallbackReason`)
  - Added fallback usage logging event `summary_provider_unavailable_local_fallback`
- ✅ Wired AI Summary frontend to backend persistence path:
  - `AISummaryPage` now calls `POST /api/ai/summaries` during generation flow
  - Summary preview now uses backend-generated text and tracks persisted `summary.id`
  - Save action now confirms persisted summary ID instead of implying local-only persistence
- ✅ Added automatic Interaction History logging for saved AI summaries:
  - `POST /api/ai/summaries` now auto-creates a linked `Interaction` when `interactionId` is not provided
  - Existing interaction linkage still works when `interactionId` is provided
  - Response now returns `interactionId` and `interactionCreated` alongside `interactionLinked`
- ✅ Improved Interaction History readability for AI summaries:
  - Auto-created interaction notes now scaffold from actual AI summary content (preview snippet), not a generic placeholder
  - Timeline entries now provide a `Show Full Summary` / `Hide Full Summary` toggle to inspect full AI summary text
- ✅ Added automatic task extraction and creation from summary text:
  - Backend now extracts explicit follow-up actions from generated AI summary text
  - Due dates are normalized to `YYYYMMDD` before task creation
  - Date hints such as `next Monday`, weekday names, `tomorrow`, and explicit date forms are parsed into concrete dates
  - New tasks are persisted as `NextStep` records when a due date is inferable

## Reproducible Validation Commands

### 1. Verify Component File Exists

```bash
ls -la greenfn-web/src/components/PostInteractionQuestionnaireForm.tsx
```

Expected: File exists with ~380 lines of TSX code.

### 2. Verify AISummaryPage Integration

```bash
grep -n "PostInteractionQuestionnaireForm\|Contact\|import" greenfn-web/src/pages/AISummaryPage.tsx | head -10
```

Expected Output:

- Imports for `PostInteractionQuestionnaireForm` component
- Contact selection logic
- Form integration with `onSubmit` handler

### 3. Verify Frontend Build Passes

```bash
cd greenfn-web && npm run build
```

Expected: Build succeeds with no TypeScript or bundler errors.

### 3b. Verify Backend AI Routes Syntax

```bash
node --check greenfn/src/modules/ai/routes.js
```

Expected: No syntax errors.

### 3d. Verify Backend AI Service Syntax

```bash
node --check greenfn/src/modules/ai/service.js
```

Expected: No syntax errors.

### 3f. Verify Prisma Client Generation (Schema Valid)

```bash
cd greenfn && npm run prisma:generate
```

Expected: Prisma client generated successfully.

### 3g. Verify Deployment Controls Wiring

```bash
grep -n "AI_TIMEOUT_MS\|AI_RATE_LIMIT_WINDOW_MS\|AI_RATE_LIMIT_MAX_REQUESTS" greenfn/src/config/env.js greenfn/.env.example greenfn/src/modules/ai/routes.js
```

Expected: Matches show env declaration, defaults, exports, and route wiring.

### 3h. Verify Metrics Dashboard Endpoint Wiring

```bash
grep -n "getAIMetricsSnapshot\|/metrics\|series\|estimatedCostUsd" greenfn/src/modules/ai/logging.js greenfn/src/modules/ai/routes.js
```

Expected: Matches show metrics aggregator logic and `/api/ai/metrics` route.

### 3i. Verify Provider-Unavailable Fallback Wiring

```bash
grep -n "summary_provider_unavailable_local_fallback\|buildLocalFallbackSummary\|isAiProviderUnavailable\|degraded" greenfn/src/modules/ai/routes.js
```

Expected: Matches show fallback detection, local summary generation, fallback logging, and degraded response metadata.

### 3j. Verify End-to-End Summary Persistence

```bash
curl -i -X POST http://localhost:3000/api/ai/summaries \
  -H "Content-Type: application/json" \
  -d '{
    "contactId":"<contact-id>",
    "sourceMode":"unstructured",
    "input":"Client wants stable premiums and agreed to review two options next week."
  }'
```

Expected: `200` response with `summary.id` populated and `summary.text` present.

### 3e. Verify Safety/Limit Helpers Are Wired

```bash
grep -n "validateContentSafety\|validateInputTokenLimit\|maxInputTokens\|maxSummaryOutputChars\|maxDraftOutputChars" greenfn/src/modules/ai/service.js
```

Expected: Matches show safety and limit checks in both `generateSummary` and `draftMessage` flows.

### 3c. Verify Backend Endpoint Contract (With Env Loaded)

```bash
cd greenfn && npm run server
```

Example request (structured):

```bash
curl -X POST http://localhost:3000/api/ai/summaries \
  -H "Content-Type: application/json" \
  -d '{
    "contactId":"seed-contact-alice",
    "sourceMode":"structured",
    "structuredInput":{
      "keyPoints":"Reviewed goals for education planning",
      "clientNeeds":"Wants predictable premium and clear timeline",
      "nextSteps":"Send two options and arrange next call",
      "followUpAction":"Send proposal by Friday"
    }
  }'
```

Example request (unstructured):

```bash
curl -X POST http://localhost:3000/api/ai/summaries \
  -H "Content-Type: application/json" \
  -d '{
    "contactId":"seed-contact-alice",
    "sourceMode":"unstructured",
    "input":"Client asked for lower-risk options and requested a follow-up next week."
  }'
```

Expected: `200` with response object under `summary` containing `text`, `model`, `sourceMode`, `usage`, `generatedAt`.

Expected persisted contract update: response `summary` now also includes `id`, `interactionLinked`, `interactionId`, `interactionCreated`, `tasksCreatedCount`, and `tasksCreated` (with `dueDateYmd` in `YYYYMMDD`).

### 4. Run Frontend Dev Server and Check Routes

```bash
cd greenfn-web && npm run dev
```

Then navigate to: `http://localhost:5173/ai-summary`

**Observable Checks:**

- ✅ Page header displays "AI Interaction Summaries"
- ✅ Contact selector dropdown loads contacts from API (or shows "No contacts found")
- ✅ Questionnaire form renders with input mode selector
- ✅ All 4 input mode buttons visible: "Structured Fields", "Pasted Meeting Summary", "Unstructured Notes", "Chat Transcript"
- ✅ Structured Fields mode shows: Key Points, Client Needs, Next Steps, Follow-Up Action fields
- ✅ Pasted Summary mode shows: single large textarea with helper text
- ✅ Unstructured Notes mode shows: large textarea with freedom message
- ✅ Chat Transcript mode shows: platform selector + transcript textarea
- ✅ Switching between modes updates form display correctly
- ✅ Submit button labeled "Generate Summary"
- ✅ Explanatory card with input mode descriptions
- ✅ No console errors

### 5. Verify Component Props and Types

```bash
grep -A 5 "type Props" greenfn-web/src/components/PostInteractionQuestionnaireForm.tsx
```

Expected: `onSubmit` callback prop and `isLoading` state support defined.

## File-Type Purpose Rundown

### `PostInteractionQuestionnaireForm.tsx`

**Purpose:** Reusable React component for capturing interaction details in multiple input modes, with validation and state management.

**Key Responsibilities:**

- Manage form state for 4 input modes
- Validate input based on selected mode
- Render mode-specific UI and labels
- Handle form submission and error messages

**Exports:** `PostInteractionQuestionnaireForm` component (default export)

**Dependencies:** `Badge`, `Button`, `Card`, `Input`, `Label`, `Textarea` UI components

### `AISummaryPage.tsx` (Updated)

**Purpose:** Main page for initiating AI-powered interaction summaries. Provides contact selection and integrates the questionnaire form.

**Key Responsibilities:**

- Fetch and display list of contacts
- Allow contact selection for summary context
- Render the questionnaire form
- Display helpful guidance on input modes

**Route:** `/ai-summary` (wired in `AppRoutes.tsx`)

**Dependencies:** `PostInteractionQuestionnaireForm` custom component, UI components, `VITE_API_BASE_URL` env variable

## Next Task

Next task after completing AI Interaction Summaries: Assisted Messaging for Next Steps — FRONTEND — "Build message draft panel triggered from due message-related tasks."

## Testing Notes

- Form validation prevents submission of empty inputs.
- Each mode switches UI dynamically based on selection.
- Form state persists when switching modes (data is not lost).
- Component is ready for backend integration: `onSubmit` callback receives complete form data including selected mode and all inputs.
