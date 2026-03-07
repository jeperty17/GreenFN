# Prisma Error Mapping Task Review

## Summary

This task added a Prisma error mapping strategy for API-friendly responses.

- Added centralized Prisma error mapper utility.
- Wired mapper into global Express error middleware.
- Standardized Prisma error HTTP status/message mapping.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn
node -e "const { mapPrismaError } = require('./src/utils/prismaError'); const e = (c,m={}) => ({ code: c, meta: m }); console.log(mapPrismaError(e('P2002',{ target:['email'] })).statusCode); console.log(mapPrismaError(e('P2025',{ cause:'Record not found' })).statusCode); console.log(mapPrismaError(e('P2003',{ field_name:'Contact_stageId_fkey (index)' })).statusCode);"
```

Expected output status codes: `409`, `404`, `409`.

## Commands to Check Observable Effects

Optional live middleware shape check by simulating mapped errors in a route or service and observing API response payload.

## File Type Rundown (What was created/updated)

- **Mapper utility** (`greenfn/src/utils/prismaError.js`): Prisma code-to-HTTP mapping.
- **Error middleware** (`greenfn/src/middleware/errorHandler.js`): applies mapper globally before response serialization.
- **Strategy doc** (`docs/prisma-error-mapping.md`): mapping matrix and behavior contract.
- **Tracking files** (`TASKS.md`, `REVIEW/README.md`, `LOG.md`): setup completion and audit trail.
