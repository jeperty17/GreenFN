# Agent Methodology (GreenFN)

This document is the reusable playbook for future coding sessions.

## Session flow

1. Read `TASKS.md`, `LOG.md`, and relevant `REVIEW/*.md`.
2. Confirm the single next target item.
3. Present concise rundown of planned action.
4. Execute only after user confirmation.
5. Verify with focused commands.
6. Update `TASKS.md`, `REVIEW/*`, and `LOG.md`.

## Completion checklist

- [ ] Scope completed exactly as requested
- [ ] No unrelated file edits
- [ ] Verification commands run (or blocker documented)
- [ ] `TASKS.md` status updated accurately
- [ ] `REVIEW/*.md` updated for completed task
- [ ] `LOG.md` appended with next `LOG-XXXX`

## `LOG.md` entry template

```text
### LOG-XXXX
- TASK: <task name>
- SUBTASK: <subtask name>
- COMPLETED_AT: <YYYY-MM-DD HH:mm:ss Z>
- FILES_CHANGED: <file1, file2, ...>
- CHANGE_SUMMARY: <what was completed>
```

## `REVIEW/<TASK>.md` template

```markdown
# <Task Name> Task Review

## Summary

<what was completed>

## Commands to Reproduce / Run

<commands>

## Commands to Check Route/Visible Effects

<commands>

## File Type Rundown

- <type/purpose>
```
