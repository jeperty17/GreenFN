# Prisma Seeding Task Review

## Summary

This task established baseline local development seed data for pipeline and contact workflows.

- Added idempotent seed script at `greenfn/prisma/seed.js`.
- Added npm command `prisma:seed`.
- Seed run verified twice with stable output counts.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn
npm run prisma:seed
```

## Commands to Check Observable Effects

Idempotency check (run twice):

```bash
cd greenfn
npm run prisma:seed
npm run prisma:seed
```

Expected seed output:

- `Pipeline stages: 7`
- `Contacts: 3`
- `Tags: 2`

Optional DB-level checks:

```bash
cd greenfn
node -e "require('dotenv/config'); const { Client } = require('pg'); (async () => { const c = new Client({ connectionString: process.env.DIRECT_URL }); await c.connect(); const r = await c.query(\"select (select count(*) from \\\"PipelineStage\\\" where \\\"advisorId\\\"='seed-advisor-001') as stages, (select count(*) from \\\"Contact\\\" where \\\"advisorId\\\"='seed-advisor-001') as contacts, (select count(*) from \\\"Tag\\\" where \\\"advisorId\\\"='seed-advisor-001') as tags\"); console.table(r.rows); await c.end(); })().catch((e) => { console.error(e); process.exit(1); });"
```

## File Type Rundown (What was created/updated)

- **Seed script** (`greenfn/prisma/seed.js`): deterministic baseline records for local dev.
- **Backend scripts** (`greenfn/package.json`): exposes `npm run prisma:seed`.
- **Seeding doc** (`docs/prisma-seeding.md`): scope and behavior of seeded data.
- **Tracking files** (`TASKS.md`, `REVIEW/README.md`, `LOG.md`): task completion, review index, and append-only log.
