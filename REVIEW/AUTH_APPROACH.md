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
