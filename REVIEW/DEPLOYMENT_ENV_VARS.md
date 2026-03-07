# Deployment Environment Variables Task Review

## Summary

This task configured deployment environment variables across backend (Railway) and frontend (Vercel).

- Railway service: `greenfn-api`
- Vercel project: `greenfn-web`
- Backend vars configured: database, runtime, AI provider/model, and `OPENAI_API_KEY`
- Frontend var configured: `VITE_API_BASE_URL` (Production + Development)

## Reproducible Run / Validation Commands

From backend folder:

```bash
cd greenfn
npx @railway/cli status
npx @railway/cli variable list -s greenfn-api -k | cut -d= -f1 | sort
```

From frontend folder:

```bash
cd greenfn-web
npx vercel env list
```

## Observable Checks

- Railway variable names include:
  - `DATABASE_URL`, `DIRECT_URL`, `NODE_ENV`, `PORT`
  - `AI_PROVIDER`, `AI_PRIMARY_MODEL`, `AI_FALLBACK_MODEL`, `OPENAI_API_KEY`
- Vercel contains encrypted `VITE_API_BASE_URL` entries for Production and Development.
- Preview-specific Vercel env target is pending Git repository connection in Vercel.

## File-Type Purpose Rundown

- `TASKS.md` — marks env-var setup item completed.
- `REVIEW/DEPLOYMENT_ENV_VARS.md` — reproducible verification and scope notes.
- `REVIEW/README.md` — review index update.
- `LOG.md` — append-only audit entry for this completion.
