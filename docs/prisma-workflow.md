# Prisma Client + Migration Workflow

## NPM scripts (backend)

From `greenfn/package.json`:

- `npm run prisma:generate` — generate Prisma client into `greenfn/generated/prisma`
- `npm run prisma:migrate:dev` — create/apply development migration
- `npm run prisma:migrate:status` — check migration/database sync status
- `npm run prisma:migrate:deploy` — apply pending migrations (deploy flow)
- `npm run prisma:db:push` — push schema changes without migration files (non-prod utility)
- `npm run prisma:studio` — open Prisma Studio

## Recommended workflow

1. Update `prisma/schema.prisma`.
2. Run `npm run prisma:migrate:dev` for schema changes that need migration history.
3. Run `npm run prisma:generate`.
4. Run `npm run prisma:migrate:status` to verify alignment.

## Notes

- Prisma configuration is defined in `greenfn/prisma.config.ts`.
- Datasource URL resolves from `DIRECT_URL`.
- Generated client output path is configured in `prisma/schema.prisma` as `../generated/prisma`.

## Short-Term Team Checklist (Parallel Development)

Use this checklist for every schema-related PR while multiple teammates are developing in parallel.

1. Classify the migration as exactly one phase: `expand`, `adopt`, or `contract`.
2. Rebase branch onto latest `main` before generating a new migration.
3. For `expand`: add only additive, backward-compatible changes (nullable columns/new tables/indexes).
4. For `adopt`: ensure app code supports both old and new schema paths during the compatibility window.
5. For `contract`: execute only in a dedicated cleanup PR after compatibility gates are met.
6. If multiple branches touched the same table, merge code first, then create one reconciliation migration on top of `main`.
7. Keep seed scripts idempotent (`upsert`/`skipDuplicates`) and re-runnable.
8. Run narrow checks before merge:
   - `npm run prisma:generate`
   - `npm run prisma:migrate:status`
   - `npx prisma validate`
   - target endpoint smoke checks for affected feature routes
9. Document rollback plan for `contract` changes (what to revert and how to restore data path if needed).
