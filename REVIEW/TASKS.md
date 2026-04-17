# Tasks / Today View

## Task Summary

Completed the remaining Today-view backend and deployment work by adding task activity audit logging, a scheduled reminder scan worker, and failure alerting for the task-check job. The Today task management flow already covered list/calendar rendering, add/edit, mark done, delete, reschedule, and the pipeline-triggered nudge prompt.
The Tasks page also includes a fully wired Calendar tab for monthly OPEN-task viewing with day chips and a day-detail panel.

## Completed Items

- ✅ Today view already supports overdue, due-today, and upcoming task buckets.
- ✅ Today view already supports a Calendar tab with monthly OPEN-task viewing and day-detail actions.
- ✅ Today view already supports task creation, completion, delete, and reschedule actions.
- ✅ Added task activity log persistence for create, update, complete, delete, and reminder-triggered events.
- ✅ Added a scheduled reminder scan worker that records daily open-task reminders.
- ✅ Added failure alert delivery for the scheduled reminder worker.
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

### 2. Validate Prisma migration and client generation

```bash
cd greenfn && npm run prisma:generate && npm run prisma:migrate:deploy
```

Expected: Prisma client regenerates and all migrations apply successfully.

### 3. Validate scheduled reminder worker

```bash
cd greenfn && node src/workers/taskReminderWorker.js
```

Expected: Worker prints a reminder scan summary and exits cleanly.

### 4. Validate Leads Pipeline frontend diagnostics

```bash
grep -n "Follow-up Suggestion\|Create Suggested Task\|followUpSuggestion" greenfn-web/src/pages/LeadsPipelinePage.tsx
```

Expected: Matches found for the suggestion banner and create-task action.

### 5. Validate task list/calendar components remain wired

```bash
grep -n "mark done\|reschedule\|CalendarView\|TaskSection" greenfn-web/src/pages/TasksPage.tsx greenfn-web/src/components/tasks/*.tsx
```

Expected: Matches show existing Today-task actions and layout are intact.

### 6. Verify Singapore timezone helpers are in use

```bash
grep -n "Asia/Singapore\|getTaskDateKey\|getTodayTaskDateKey" greenfn-web/src/components/tasks/*.ts* greenfn/src/modules/tasks/*.js
```

Expected: Matches show timezone helpers are used by Today view and backend bucketing.

### 7. Validate task activity log wiring

```bash
grep -n "TaskActivityLog\|TASK_REMINDER_ALERT_WEBHOOK_URL\|taskReminderWorker" greenfn/prisma/schema.prisma greenfn/src/modules/tasks/*.js greenfn/src/workers/*.js greenfn/package.json
```

Expected: Matches show the task audit model, reminder worker, and alert hook are wired.

## Observable Checks

1. Move a lead to a new stage.
2. Complete the stage transition.
3. Confirm the follow-up suggestion banner appears with a due date and task title.
4. Click Create Suggested Task and verify the task is persisted.
5. Open the Today page and confirm the new task appears in the correct bucket.
6. Confirm due dates render the same on backend buckets, task cards, and calendar cells regardless of host timezone.
7. Run the reminder worker and confirm it reports a scan summary and creates audit log rows for due/overdue open tasks.
8. Trigger a worker failure in a controlled test environment and confirm the alert webhook path is used when configured.

## File-Type Purpose Rundown

- `greenfn-web/src/pages/LeadsPipelinePage.tsx`: Shows pipeline cards and now renders the follow-up suggestion prompt.
- `greenfn/src/modules/pipeline/routes.js`: Emits the follow-up suggestion payload and transition metadata.
- `greenfn-web/src/pages/TasksPage.tsx`: Displays the Today task buckets and task actions.
- `greenfn-web/src/components/tasks/*`: Shared task list, card, calendar, and modal UI pieces.
- `greenfn/src/modules/tasks/activity.js`: Writes audit log snapshots for task lifecycle events.
- `greenfn/src/modules/tasks/reminders.js`: Scans due/overdue tasks and creates daily reminder logs.
- `greenfn/src/modules/tasks/alerts.js`: Sends failure alerts for scheduled task reminder jobs.
- `greenfn/src/workers/taskReminderWorker.js`: Runs the scheduled reminder scan as a standalone job entrypoint.
