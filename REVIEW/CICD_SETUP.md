# CI/CD Setup Task Review

## Summary

This task set up CI/CD from `main` with preview deployments using GitHub Actions.

- Frontend Vercel preview deployment on Pull Requests to `main`.
- Frontend Vercel production deployment on pushes to `main`.
- Backend Railway deployment on pushes to `main`.

## Reproducible Run / Validation Commands

From repository root:

```bash
ls .github/workflows
cat .github/workflows/frontend-vercel.yml
cat .github/workflows/backend-railway.yml
```

## Observable Checks

- PR to `main` touching `greenfn-web/**` triggers Vercel preview workflow job.
- Push to `main` touching `greenfn-web/**` triggers Vercel production workflow job.
- Push to `main` touching `greenfn/**` triggers Railway deployment workflow job.
- Required GitHub secrets are documented in `docs/cicd-setup.md`.

## File-Type Purpose Rundown

- `.github/workflows/frontend-vercel.yml` — frontend preview/prod CI deploy pipeline.
- `.github/workflows/backend-railway.yml` — backend main-branch deploy pipeline.
- `docs/cicd-setup.md` — secrets/setup guidance and CI/CD behavior notes.
- `TASKS.md`, `REVIEW/README.md`, `LOG.md` — checklist, review index, and append-only logging updates.
