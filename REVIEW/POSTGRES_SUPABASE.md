# PostgreSQL (Supabase) Task Review

## Summary

This task confirmed Supabase PostgreSQL connectivity and hardened backend environment handling by requiring database connection variables at runtime and providing a safe backend `.env.example` template.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn
npm install
npx prisma migrate status
```

Start backend with env loaded:

```bash
cd greenfn
npm run dev
```

## Commands to Check Observable Effects

Check migration connectivity/state:

```bash
cd greenfn
npx prisma migrate status
```

Expected: Prisma loads `prisma.config.ts`, connects to PostgreSQL, and reports migration state.

Check backend starts with required env vars present:

```bash
cd greenfn
npm run dev
```

Expected: server listens on configured port.

Check failure behavior for missing required db env vars:

```bash
cd greenfn
cp .env .env.backup
cp .env.example .env
npm run dev
mv .env.backup .env
```

Expected: startup fails fast with `Missing required environment variable` unless placeholder values are replaced.

## File Type Rundown (What was created/updated)

- **Backend env template** (`greenfn/.env.example`): placeholder-based, non-secret configuration for local setup.
- **Backend env config module** (`greenfn/src/config/env.js`): runtime env loading with required variable checks for `DATABASE_URL` and `DIRECT_URL`.
- **Project tracking files** (`TASKS.md`, `LOG.md`, `REVIEW/README.md`): setup progress and review index updates.
