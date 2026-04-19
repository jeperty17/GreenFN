# Authentication Approach Task Review

## Summary

This task finalized the setup-level authentication direction for GreenFN MVP:

- Chosen approach: **custom JWT with user table**.
- Deferred option: Supabase Auth for post-MVP migration if needed.

The detailed decision record is documented in `docs/auth-approach.md`.

## Commands to Reproduce / Run

No runtime code execution is required for this task because it is a decision/documentation milestone.

## Commands to Check Observable Effects

From repository root:

```bash
cat docs/auth-approach.md
cat REVIEW/AUTH_APPROACH.md
```

Checklist confirmation in setup tracker:

```bash
grep -n "Decide and document auth approach" TASKS.md
```

Expected: the auth approach setup item is checked (`[x]`) and docs contain rationale + boundaries.

## File Type Rundown (What was created/updated)

- **Decision record** (`docs/auth-approach.md`): canonical auth strategy for MVP and migration notes.
- **Task review doc** (`REVIEW/AUTH_APPROACH.md`): reproducible checks and audit trail for this completed setup item.
- **Tracking files** (`TASKS.md`, `REVIEW/README.md`, `LOG.md`): completion status, review index entry, and append-only change log.

---

## Authentication Gating Implementation (Frontend + Backend)

### Summary

Added a working login gate so `greenfn-web` requires authentication before protected pages are accessible.

- Backend now exposes functional auth endpoints:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- Protected API modules now require Bearer token auth middleware.
- Frontend now has:
  - `LoginPage`
  - `AuthProvider` with token persistence/bootstrap session check
  - route guard via `RequireAuth`
  - logout control in app layout

### Reproducible Validation Commands

Backend auth endpoint checks:

```bash
cd greenfn
npm run dev

# Unauthenticated protected endpoint should be blocked
node -e 'const http=require("http");http.get("http://localhost:3000/api/contacts?page=1&pageSize=1",(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{console.log(res.statusCode,d);});});'

# Login should return access token
node -e 'const http=require("http");const body=JSON.stringify({email:"advisor.seed@greenfn.local",password:"password123"});const req=http.request("http://localhost:3000/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{console.log(res.statusCode,d);});});req.write(body);req.end();'

# /auth/me should succeed with bearer token
node -e 'const http=require("http");const body=JSON.stringify({email:"advisor.seed@greenfn.local",password:"password123"});const login=http.request("http://localhost:3000/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{const token=JSON.parse(d).accessToken;const req=http.request("http://localhost:3000/api/auth/me",{method:"GET",headers:{Authorization:"Bearer "+token}},(meRes)=>{let md="";meRes.on("data",c=>md+=c);meRes.on("end",()=>{console.log(meRes.statusCode,md);});});req.end();});});login.write(body);login.end();'
```

Frontend compile validation:

```bash
cd greenfn-web
npm run build
```

### Observable Checks

- Calls to protected modules without token return `401`.
- Login with configured credentials returns an access token and user payload.
- Auth bootstrap resolves session with `/api/auth/me` when token exists.
- App routes under `/` require login; `/login` remains public.
- Logout clears local token and returns user to gated state.

### File Type Rundown (Implementation Additions)

- `greenfn/src/modules/auth/routes.js` — functional auth endpoints and token/session payload behavior.
- `greenfn/src/middleware/requireAuth.js` — bearer-token verification middleware.
- `greenfn/src/lib/jwtAuth.js` — JWT sign/verify helpers.
- `greenfn/src/routes/index.js` — auth middleware gate for protected modules.
- `greenfn/src/config/env.js`, `greenfn/.env.example` — auth credential and JWT env configuration.
- `greenfn-web/src/context/AuthContext.tsx` — token persistence, auth fetch patching, session bootstrap, login/logout methods.
- `greenfn-web/src/pages/LoginPage.tsx` — login form and redirect behavior.
- `greenfn-web/src/routes/RequireAuth.tsx`, `greenfn-web/src/routes/AppRoutes.tsx` — protected route enforcement.
- `greenfn-web/src/main.tsx`, `greenfn-web/src/layouts/AppLayout.tsx` — provider wiring and logout control.

---

## User Signup (Name + Email + Password)

### Summary

Extended auth to support new-user self-signup using the minimum required fields for sidebar identity display:

- Added `POST /api/auth/signup` accepting `name`, `email`, and `password`.
- Signup now creates a `User` record with hashed password and immediately returns JWT + user payload.
- Login now supports:
  - password-hash validation for signed-up users
  - fallback env credential path for legacy local seed login behavior
- Frontend login screen now includes **Sign in / Sign up** mode toggle and submit wiring.
- Auth context now exposes `signup(...)` and persists the new session exactly like login.

### Reproducible Validation Commands

Backend schema validation:

```bash
cd greenfn
npx prisma validate
```

Frontend compile validation:

```bash
cd greenfn-web
npm run build
```

Signup + login API checks (backend running on :3000):

```bash
node -e 'const http=require("http");const body=JSON.stringify({name:"Demo Advisor",email:"demo.signup@greenfn.local",password:"password123"});const req=http.request("http://localhost:3000/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>console.log(res.statusCode,d));});req.write(body);req.end();'

node -e 'const http=require("http");const body=JSON.stringify({email:"demo.signup@greenfn.local",password:"password123"});const req=http.request("http://localhost:3000/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},(res)=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>console.log(res.statusCode,d));});req.write(body);req.end();'
```

### Observable Checks

- On `/login`, switching to **Sign up** shows `Name`, `Email`, `Password` fields.
- Successful signup authenticates user immediately and navigates into the protected app.
- Sidebar shows the newly registered user's `name` and `email`.
- Existing local fallback login (`advisor.seed@greenfn.local` + configured env password) still works.

### File Type Rundown (Signup Additions)

- `greenfn/src/modules/auth/routes.js` — signup endpoint, hash-based login path, and token response unification.
- `greenfn/prisma/schema.prisma` — added `User.passwordHash`.
- `greenfn/prisma/migrations/20260418143500_user_add_password_hash/migration.sql` — additive user password-hash column migration.
- `greenfn/prisma/seed.js` — seed advisor now gets hashed password for credential login compatibility.
- `greenfn-web/src/context/AuthContext.tsx` — added `signup` method to auth client state.
- `greenfn-web/src/pages/LoginPage.tsx` — added sign-in/sign-up mode toggle and signup form flow.

---

## Contact-Creation FK Violation Fix (Auth Identity Backfill)

### Summary

Fixed a contact-create failure where some sessions used a token `sub` not present in the `User` table, causing `Contact.advisorId` foreign-key violations:

- Removed `local-auth-user` fallback identity issuance from login.
- For env-credential login fallback, backend now creates a real advisor user row when needed before issuing JWT.
- Contacts advisor resolution now self-heals legacy tokens by resolving advisor by token id, then by email, and creating a user row if required.

### Reproducible Validation Commands

```bash
cd greenfn
DATABASE_URL='postgresql://local' DIRECT_URL='postgresql://local' JWT_ACCESS_SECRET='x' node -e "require('./src/modules/auth/routes'); require('./src/modules/contacts/routes'); console.log('auth-contacts-routes-ok')"
```

```bash
cd greenfn-web
npm run build
```

### Observable Checks

- Creating a contact no longer fails with FK violation for advisor linkage.
- New and fallback-auth sessions now resolve to persisted advisor identities.

### Files Updated

- `greenfn/src/modules/auth/routes.js` — removed ephemeral login identity fallback and ensured env-login advisor persistence.
- `greenfn/src/modules/contacts/routes.js` — hardened advisor resolution/backfill to guarantee valid `advisorId` relationships before writes.

---

## Signup UX/Error Feedback Fix

### Summary

Improved signup reliability from the login page by preventing accidental duplicate-signup defaults and surfacing backend error messages consistently:

- Signup mode now clears prefilled sign-in credentials (seed email/password) so users don't unintentionally submit an already-used email.
- Switching back to sign-in restores the local seed defaults for quick local login.
- Auth client error parsing now reads both `payload.message` and `payload.error.message`, so backend validation/conflict messages are displayed instead of generic failures.

### Reproducible Validation Commands

```bash
cd greenfn-web
npm run build
```

Run app locally:

```bash
cd greenfn-web
npm run dev
```

### Observable Checks

- Open `/login` and click `Sign up` → email/password fields are blank.
- Try signing up with an existing email → specific backend error message is shown.
- Click back to `Sign in` → seed login defaults are restored.

### Files Updated

- `greenfn-web/src/pages/LoginPage.tsx` — mode-switch field reset behavior for sign-in/sign-up.
- `greenfn-web/src/context/AuthContext.tsx` — improved auth error message extraction for login/signup failures.

---

## Signup Validation Detail Messaging

### Summary

Made auth failures actionable by surfacing backend validation detail entries in the login/signup UI:

- Auth client now parses `error.details` arrays returned by backend validation middleware.
- Field-level validation issues are appended to the base message (e.g., `email: email must be valid; password: password must be at least 8 characters`).
- This removes ambiguous `Validation failed` responses in signup/login flows.

### Reproducible Validation Commands

```bash
cd greenfn-web
npm run build
```

Run app locally:

```bash
cd greenfn-web
npm run dev
```

### Observable Checks

- Submit signup with invalid email or short password.
- Error banner now includes specific field-level messages instead of only `Validation failed`.

### Files Updated

- `greenfn-web/src/context/AuthContext.tsx` — added centralized auth error message builder that includes backend validation detail lines.
