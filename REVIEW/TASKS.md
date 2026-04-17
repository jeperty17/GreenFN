# Tasks / Today View

## Task Summary

Completed the remaining user-facing Today-view nudge behavior by surfacing pipeline stage follow-up suggestions as an optional prompt and one-click task creation action on the Leads Pipeline page. The existing Today task management flow already covered list/calendar rendering, add/edit, mark done, delete, and reschedule.

## Completed Items

- ✅ Today view already supports overdue, due-today, and upcoming task buckets.
- ✅ Today view already supports task creation, completion, delete, and reschedule actions.
- ✅ Added an optional follow-up suggestion prompt after pipeline stage movement.
- ✅ Added one-click creation of a suggested task from the stage-change follow-up prompt.
- ✅ Reused normalized `YYYYMMDD` due-date suggestions from the pipeline backend when creating the task.
- ✅ Aligned Today-view task bucketing, add-task minimum date, and date display formatting to the same Singapore timezone on frontend and backend.

## Reproducible Validation Commands

### 1. Validate the pipeline page syntax

```bash
cd greenfn-web && npm run build
```

Expected: Build succeeds with no TypeScript or bundler errors.

### 2. Validate Leads Pipeline frontend diagnostics

```bash
grep -n "Follow-up Suggestion\|Create Suggested Task\|followUpSuggestion" greenfn-web/src/pages/LeadsPipelinePage.tsx
```

Expected: Matches found for the suggestion banner and create-task action.

### 3. Validate task list/calendar components remain wired

```bash
grep -n "mark done\|reschedule\|CalendarView\|TaskSection" greenfn-web/src/pages/TasksPage.tsx greenfn-web/src/components/tasks/*.tsx
```

Expected: Matches show existing Today-task actions and layout are intact.

### 4. Verify Singapore timezone helpers are in use

```bash
grep -n "Asia/Singapore\|getTaskDateKey\|getTodayTaskDateKey" greenfn-web/src/components/tasks/*.ts* greenfn/src/modules/tasks/*.js
```

Expected: Matches show timezone helpers are used by Today view and backend bucketing.

## Observable Checks

1. Move a lead to a new stage.
2. Complete the stage transition.
3. Confirm the follow-up suggestion banner appears with a due date and task title.
4. Click Create Suggested Task and verify the task is persisted.
5. Open the Today page and confirm the new task appears in the correct bucket.
6. Confirm due dates render the same on backend buckets, task cards, and calendar cells regardless of host timezone.

## File-Type Purpose Rundown

- `greenfn-web/src/pages/LeadsPipelinePage.tsx`: Shows pipeline cards and now renders the follow-up suggestion prompt.
- `greenfn/src/modules/pipeline/routes.js`: Emits the follow-up suggestion payload and transition metadata.
- `greenfn-web/src/pages/TasksPage.tsx`: Displays the Today task buckets and task actions.
- `greenfn-web/src/components/tasks/*`: Shared task list, card, calendar, and modal UI pieces.
