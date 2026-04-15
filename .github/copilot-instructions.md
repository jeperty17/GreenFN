# GreenFN Copilot Operating Contract

Follow this contract for every task in this repository.

## 1) Required startup reads (in order)

1. `TASKS.md`
2. `LOG.md`
3. `REVIEW/README.md` and relevant `REVIEW/*.md` for completed work

Do not start implementation before reading these files.

## 2) Execution style

- Work step-by-step.
- Default to **showing the next step/rundown first** for user confirmation before execution.
- Never proceed to the next unchecked setup item in `TASKS.md` unless the user explicitly says to proceed.
- Keep changes minimal, focused, and aligned to existing architecture.
- Do not modify unrelated files.

## 3) Mandatory governance updates after each completed task/change batch

- Update `LOG.md` (append-only) using the required 5 fields and integrity rules.
- If a setup/feature task is completed, add or update a corresponding `REVIEW/<TASK>.md` file including:
  - Short task summary
  - Reproducible run/validation commands
  - Observable checks (routes/effects)
  - Brief file-type purpose rundown
- Reflect status changes in `TASKS.md` only for items actually completed.

## 4) Logging integrity requirements

- Follow all `Logging Rules` and `Integrity Checklist` in `LOG.md`.
- Exactly one `### LOG-XXXX` heading per entry.
- Exactly one value per required field.
- Strict ascending entry numbering.
- New entries append at end only.

## 5) Safety and verification

- Run the narrowest relevant verification commands first.
- Report what was run and the result.
- If blocked, state the blocker clearly and provide the next best action.

## 6) Branch and push awareness

- Confirm current branch before any branch-sensitive guidance.
- If user expects `main` updates, verify whether commits are on another branch first.
- Explain exact commands to reconcile branch divergence when needed.

## 7) Parallel Team DB Workflow (Modular + Low-Conflict)

- Do not prebuild all future DB schema up front. Prefer feature-sliced, additive migrations.
- Use migration units per feature slice (small, reviewable, and merge-friendly):
  - `expand`: add nullable columns/new tables/indexes only
  - `adopt`: update app reads/writes to new fields
  - `contract`: remove legacy fields later in a dedicated cleanup step
- Never edit or reorder already-merged migration files. Add a new migration for any correction.
- Rebase onto latest `main` before creating a new migration to reduce drift.
- If two branches modify the same table, merge code first, then create one reconciliation migration on top.
- Keep seed scripts idempotent (`upsert`/`skipDuplicates`) so teammates can reset safely.
- For schema changes, run narrow verification first: `prisma validate`, migration status, targeted endpoint checks.

### Mandatory Compatibility Window and Contract Gates

- During `expand` and `adopt`, maintain backward compatibility across one full integration cycle: old and new schema paths must both remain readable/writable until all dependent branches are merged.
- Do not run `contract` in the same PR as `expand` or first-time `adopt` for a feature slice.
- `contract` is allowed only when all gates are true:
  - No remaining app references to legacy fields/endpoints.
  - Staging verification passes for affected routes and critical user flows.
  - Team confirms active branches touching the same table have rebased onto latest `main`.
  - A rollback path is documented (revert/restore plan and data recovery notes when applicable).

### Shared-Table Collision Protocol

- If multiple branches change the same table, merge application code first, then add exactly one reconciliation migration on top of latest `main`.
- Never rewrite already-merged migrations to resolve conflicts.
- Each migration PR must declare: migration phase (`expand|adopt|contract`), owner, affected tables/indexes, and compatibility impact.

### Contract Cleanup Cadence

- Prefer dedicated cleanup windows for `contract` changes instead of bundling with active feature delivery.
- Keep `contract` PRs small and reviewable (schema cleanup + minimal app cleanup only).

### Contacts Hub DB/Deployment Hold Rule

- Until explicitly requested by the user, do **not** execute Contacts Hub `DB` or `DEPLOYMENT` checklist items in `TASKS.md`.
- Allowed while hold is active: Contacts Hub `FRONTEND` and `BACKEND` implementation tasks only.
- If asked to continue Contacts Hub work, stop at the next DB/Deployment boundary and request confirmation.
