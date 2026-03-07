# Prisma Error Mapping Strategy

## Goal

Return consistent, API-friendly HTTP responses for common Prisma errors.

## Mapping table

- `P2002` → `409 Conflict` (`Unique constraint violation`)
- `P2003` → `409 Conflict` (`Foreign key constraint violation`)
- `P2014` → `409 Conflict` (`Operation violates required relation constraints`)
- `P2025` → `404 Not Found` (`Requested record was not found`)
- Other Prisma codes → `500 Internal Server Error` (`Database operation failed`)

## Implementation

- Mapper utility: `greenfn/src/utils/prismaError.js`
- Applied in global error middleware: `greenfn/src/middleware/errorHandler.js`

## Response shape

The middleware preserves the existing API envelope:

```json
{
  "error": {
    "message": "...",
    "details": {
      "prismaCode": "P2002"
    }
  }
}
```

## Notes

- Non-Prisma errors are passed through unchanged.
- Stack traces are only included outside production, matching existing behavior.
