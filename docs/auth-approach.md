# Auth Approach Decision

## Decision

Use **custom JWT with a user table** for MVP, not Supabase Auth.

## Why this is chosen now

- The backend already has a local `auth` module scaffold (`/api/auth/login`) and Prisma `User` model ownership patterns.
- MVP scope benefits from fewer moving parts and full control over payload/session behavior.
- This avoids introducing Supabase Auth provider coupling while core CRUD modules are still being implemented.

## MVP implementation boundaries

- Credentials-based login using app-managed `users` table.
- Password hashing (`bcrypt`) and JWT access tokens signed by backend secret.
- JWT claims include `sub` (user id) and `email`; requests are scoped by advisor/user id.
- Secrets stored only in backend environment variables (no frontend secret exposure).

## Required backend environment variables

- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_EXPIRES_IN` (recommended default: `15m`)

## Migration path (post-MVP option)

If needed later, migrate to Supabase Auth by:

1. Mapping app users to Supabase user IDs.
2. Replacing custom token issuance with Supabase JWT verification middleware.
3. Keeping domain tables and advisor-scoped authorization rules intact.

## Out of scope in this step

- Full auth endpoint implementation (login/register/me/refresh).
