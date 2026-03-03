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
