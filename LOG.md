# LOG

## Purpose

Track all completed changes made in this repository, now and in the future, including:

- Updates to `TASKS.md`
- Any file additions, edits, renames, or deletions in the repo

## Logging Rules

- Append-only: never delete old entries.
- Add one entry per completed change (or tightly related change batch).
- Keep entries in ascending order (`LOG-0001`, `LOG-0002`, ...).
- Each `LOG-XXXX` heading must contain exactly one 5-field metadata block.
- Never place multiple change blocks under one `LOG-XXXX` heading.
- Always append new entries at the end of `## Entries`.
- Each entry must include:
  - TASK
  - SUBTASK
  - COMPLETED_AT (date/time with timezone)
  - FILES_CHANGED
  - CHANGE_SUMMARY
- Use local timezone timestamps in `YYYY-MM-DD HH:mm:ss Z` format.

## Integrity Checklist (Before Saving)

- Confirm latest entry ID and increment by exactly 1.
- Confirm exactly one `### LOG-XXXX` heading for the new entry.
- Confirm exactly one value for each required field.
- Confirm no orphan bullet lines exist outside a `LOG-XXXX` section.
- Confirm the new entry is appended at the end.

## Entry Format (Template)

```text
### LOG-XXXX
- TASK: <task name>
- SUBTASK: <subtask name>
- COMPLETED_AT: <YYYY-MM-DD HH:mm:ss Z>
- FILES_CHANGED: <file1, file2, ...>
- CHANGE_SUMMARY: <what was completed>
```

## Entries

### LOG-0001

- TASK: Project Planning
- SUBTASK: Create implementation task breakdown file
- COMPLETED_AT: 2026-03-03 20:24:15 +08
- FILES_CHANGED: TASKS.md
- CHANGE_SUMMARY: Created `TASKS.md` with `SETUP` and `IMPLEMENTATION` sections, including feature-specific `FRONTEND`, `BACKEND`, `DB`, and `DEPLOYMENT` subtasks.

### LOG-0002

- TASK: Project Governance
- SUBTASK: Initialize persistent change logging
- COMPLETED_AT: 2026-03-03 20:24:15 +08
- FILES_CHANGED: LOG.md
- CHANGE_SUMMARY: Created `LOG.md` with append-only rules, required entry fields, and template for all future repository/task updates.

### LOG-0003

- TASK: React Setup
- SUBTASK: Step 1 baseline assessment and frontend naming decision
- COMPLETED_AT: 2026-03-03 20:31:45 +08
- FILES_CHANGED: LOG.md
- CHANGE_SUMMARY: Completed Step 1 repository baseline check (backend-first package confirmed) and finalized `greenfn-web` as the accepted frontend folder name for upcoming React/Vite scaffolding.

### LOG-0004

- TASK: React Setup
- SUBTASK: Step 3 scaffold + bootstrap verification
- COMPLETED_AT: 2026-03-03 20:36:24 +08
- FILES_CHANGED: greenfn-web/\*, LOG.md
- CHANGE_SUMMARY: Scaffolded a new React + TypeScript Vite frontend in `greenfn-web`, installed dependencies, confirmed dev server startup on `http://localhost:5173/`, then terminated it cleanly. Verified existing backend package in `greenfn/` remained untouched.

### LOG-0005

- TASK: React Setup
- SUBTASK: Step 4 minimal route/page/layout structure
- COMPLETED_AT: 2026-03-03 20:40:12 +08
- FILES_CHANGED: greenfn-web/package.json, greenfn-web/package-lock.json, greenfn-web/src/App.tsx, greenfn-web/src/layouts/AppLayout.tsx, greenfn-web/src/routes/AppRoutes.tsx, greenfn-web/src/pages/\*, TASKS.md, LOG.md
- CHANGE_SUMMARY: Added `react-router-dom`, created a shared app layout, scaffolded placeholder pages for Contacts Hub, Leads Pipeline, Today, Interaction History, and AI Summary, wired all routes, verified successful frontend build, and updated completed React setup items in `TASKS.md`.

### LOG-0006

- TASK: React Setup
- SUBTASK: Step 5 environment variables for API base URL
- COMPLETED_AT: 2026-03-03 20:44:08 +08
- FILES_CHANGED: greenfn-web/.env.example, greenfn-web/.env.development, greenfn-web/src/vite-env.d.ts, greenfn-web/src/config/env.ts, TASKS.md, LOG.md
- CHANGE_SUMMARY: Configured frontend API base URL environment conventions via `.env.example` and `.env.development`, added typed Vite env declarations and an exported `API_BASE_URL` helper, verified successful frontend build, and marked the React env-variable setup task as completed in `TASKS.md`.

### LOG-0007

- TASK: ShadCN + Tailwind Setup
- SUBTASK: Full UI system initialization and verification
- COMPLETED_AT: 2026-03-03 20:56:23 +08
- FILES_CHANGED: greenfn-web/package.json, greenfn-web/package-lock.json, greenfn-web/components.json, greenfn-web/tailwind.config.cjs, greenfn-web/postcss.config.cjs, greenfn-web/eslint.config.js, greenfn-web/tsconfig.json, greenfn-web/tsconfig.app.json, greenfn-web/tsconfig.node.json, greenfn-web/vite.config.ts, greenfn-web/src/index.css, greenfn-web/src/main.tsx, greenfn-web/src/layouts/AppLayout.tsx, greenfn-web/src/lib/utils.ts, greenfn-web/src/components/ui/\*, greenfn-web/docs/ui-primitives.md, TASKS.md, LOG.md
- CHANGE_SUMMARY: Completed ShadCN + Tailwind setup end-to-end (config, aliases, design tokens, generated primitives, toaster integration, and UI conventions docs), resolved setup/build/lint integration issues, verified `npm run build` and `npm run lint` passing, and marked all ShadCN setup checklist items complete in `TASKS.md`.

### LOG-0008

- TASK: Review Documentation
- SUBTASK: Create per-completed-task REVIEW files for reproducibility and checks
- COMPLETED_AT: 2026-03-03 21:01:34 +08
- FILES_CHANGED: REVIEW/README.md, REVIEW/REACT.md, REVIEW/SHADCN_TAILWIND.md, LOG.md
- CHANGE_SUMMARY: Added `REVIEW` folder with task-specific review docs for completed React and ShadCN setup, including top summaries, run/reproduce commands, route/effect verification commands, and concise file-type purpose rundowns.

### LOG-0009

- TASK: Log Governance
- SUBTASK: Normalize LOG entry structure and add integrity safeguards
- COMPLETED_AT: 2026-03-03 21:05:10 +08
- FILES_CHANGED: LOG.md
- CHANGE_SUMMARY: Repaired log structure drift by restoring one-entry-per-heading integrity (`LOG-0001` through `LOG-0008`) and added explicit ordering/validation checklist rules to prevent future mis-grouped or orphaned log fields.
