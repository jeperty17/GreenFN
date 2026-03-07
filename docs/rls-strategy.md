# RLS Strategy (Per-Advisor Isolation)

## Goal

Ensure every advisor can only access rows belonging to their own data domain.

## Approach

- RLS is enabled on all domain tables in `greenfn/prisma/rls.sql`.
- Ownership root is `Contact.advisorId` and direct advisor-owned tables (`User`, `PipelineStage`, `Tag`, `MessageTemplate`).
- Child tables are constrained via owner-preserving joins back to `Contact`.

## Runtime contract with backend auth

Because MVP auth uses custom JWT, the backend must set the session variable below at the beginning of each request transaction:

- `app.current_advisor_id = <authenticated user id>`

RLS policies read this value through `app.current_advisor_id()`.

## Apply command

From `greenfn/`:

```bash
npx prisma db execute --file prisma/rls.sql
```

## Verification query examples

- Check RLS enabled per table (`relrowsecurity = true`).
- Check policies exist under `pg_policies` for all protected tables.

Example verification script:

```bash
node -e "require('dotenv/config'); const { Client } = require('pg'); (async () => { const c = new Client({ connectionString: process.env.DIRECT_URL }); await c.connect(); const r = await c.query(\"select relname, relrowsecurity from pg_class where relname in ('User','Contact','PipelineStage','Interaction','NextStep','Conversation','MessageDraft','MessageTemplate','Policy','Goal','Tag','ContactTag','ContactChannel') order by relname\"); console.table(r.rows); const p = await c.query(\"select tablename, policyname from pg_policies where schemaname='public' and tablename in ('User','Contact','PipelineStage','Interaction','NextStep','Conversation','MessageDraft','MessageTemplate','Policy','Goal','Tag','ContactTag','ContactChannel') order by tablename, policyname\"); console.table(p.rows); await c.end(); })().catch((e) => { console.error(e); process.exit(1); });"
```

## Notes

- This step enables policy definitions and table-level RLS controls.
- Full request-level enforcement depends on backend auth middleware wiring the per-request advisor id into DB sessions.
