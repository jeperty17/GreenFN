# CORS Allowlist Task Review

## Summary

This task configured backend CORS to enforce a production allowlist for frontend browser origins.

- CORS is permissive in non-production environments for local development.
- In production, only allowed origins are accepted via `CORS_ALLOWED_ORIGINS`.
- Production Railway value configured to `https://greenfn-web.vercel.app`.

## Reproducible Run / Validation Commands

From backend folder:

```bash
cd greenfn
npx @railway/cli variable list -s greenfn-api -k | grep '^CORS_ALLOWED_ORIGINS='
```

Local static checks:

```bash
cd greenfn
node -e "const env=require('./src/config/env'); console.log(Array.isArray(env.CORS_ALLOWED_ORIGINS), env.CORS_ALLOWED_ORIGINS.join(','))"
```

## Observable Checks

- `greenfn/src/app.js` uses `cors(resolveCorsOptions())`.
- Production path rejects unlisted browser origins with `CORS origin not allowed`.
- `greenfn/.env.example` documents `CORS_ALLOWED_ORIGINS` as comma-separated list.

## File-Type Purpose Rundown

- `greenfn/src/app.js` — runtime CORS policy (strict in production).
- `greenfn/src/config/env.js` — parsing/export of `CORS_ALLOWED_ORIGINS`.
- `greenfn/.env.example` — backend env template with CORS allowlist example.
- `TASKS.md`, `REVIEW/README.md`, `LOG.md` — checklist status and audit trail.
