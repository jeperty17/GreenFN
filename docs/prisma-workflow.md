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
