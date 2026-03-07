# CI/CD Setup (Main + Preview)

## Summary

CI/CD is configured with GitHub Actions:

- Frontend (`greenfn-web`) deploys to Vercel.
  - Pull Requests to `main` -> Preview deployment.
  - Pushes to `main` -> Production deployment.
- Backend (`greenfn`) deploys to Railway on pushes to `main`.

## Workflow files

- `.github/workflows/frontend-vercel.yml`
- `.github/workflows/backend-railway.yml`

## Required GitHub repository secrets

Set these in GitHub repository settings (`Settings -> Secrets and variables -> Actions`):

### Frontend / Vercel

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Backend / Railway

- `RAILWAY_TOKEN`

## Notes

- Vercel Dashboard Git integration attempt failed due repository access mismatch for the currently authenticated Vercel scope; GitHub Actions provides equivalent CI/CD behavior without requiring Dashboard repo linking.
- Vercel preview branch-specific env requires Dashboard Git connection if you want branch-targeted env values beyond this workflow-based setup.
