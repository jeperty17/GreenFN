# RLS Strategy Task Review

## Summary

This task enabled a row-level security strategy aligned with per-advisor data isolation.

- Added an executable SQL policy script at `greenfn/prisma/rls.sql`.
- Enabled RLS on advisor-owned and advisor-linked domain tables.
- Added owner-scoped policies based on `app.current_advisor_id()`.
- Documented usage and verification in `docs/rls-strategy.md`.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn
npx prisma db execute --file prisma/rls.sql
```

## Commands to Check Observable Effects

Verify RLS flags and policy presence:

```bash
cd greenfn
node -e "require('dotenv/config'); const { Client } = require('pg'); (async () => { const c = new Client({ connectionString: process.env.DIRECT_URL }); await c.connect(); const r = await c.query(\"select relname, relrowsecurity from pg_class where relname in ('User','Contact','PipelineStage','Interaction','NextStep','Conversation','MessageDraft','MessageTemplate','Policy','Goal','Tag','ContactTag','ContactChannel') order by relname\"); console.table(r.rows); const p = await c.query(\"select tablename, policyname from pg_policies where schemaname='public' and tablename in ('User','Contact','PipelineStage','Interaction','NextStep','Conversation','MessageDraft','MessageTemplate','Policy','Goal','Tag','ContactTag','ContactChannel') order by tablename, policyname\"); console.table(p.rows); await c.end(); })().catch((e) => { console.error(e); process.exit(1); });"
```

Expected:

- Every listed table shows `relrowsecurity = true`.
- Policies exist for each protected table.

## File Type Rundown (What was created/updated)

- **SQL policy script** (`greenfn/prisma/rls.sql`): idempotent RLS enablement and policy creation.
- **Strategy doc** (`docs/rls-strategy.md`): runtime contract, apply command, and verification steps.
- **Tracking files** (`TASKS.md`, `REVIEW/README.md`, `LOG.md`): setup completion, review index, and change log entry.
