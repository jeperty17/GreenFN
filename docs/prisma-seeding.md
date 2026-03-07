# Prisma Seeding Baseline (Local Development)

## Purpose

Provide deterministic baseline data for local development demos and API testing.

## Seed command

From `greenfn/`:

```bash
npm run prisma:seed
```

## What the seed creates

For advisor `seed-advisor-001`:

- 1 advisor user (`advisor.seed@greenfn.local`)
- 7 pipeline stages in order:
  - New
  - Contacted
  - Booked
  - No-show
  - In Progress
  - Closed Won
  - Closed Lost
- 3 contacts mapped to pipeline stages
- 2 tags with contact-tag links
- 1 sample interaction
- 1 sample next-step task

## Idempotency

The script is safe to run repeatedly.

- Uses deterministic IDs for seed records.
- Uses conflict-safe upserts/inserts.
- Re-running preserves stable counts for seeded entities.

## Notes

- Script path: `greenfn/prisma/seed.js`
- Uses `DIRECT_URL` (falls back to `DATABASE_URL`) via `pg` client.
- Sets `app.current_advisor_id` to align with current RLS policy setup.
