# Fix sign-in issues

## Root cause

Your project is a **Next.js (`web/`) + NestJS (`api/`) + Keycloak + Postgres** monorepo. Lovable's preview sandbox can only run a single Vite app on `localhost:8080` — it does **not** run:

- `next start` (your web frontend on :3000)
- the NestJS API (:4000)
- Keycloak (:8080 in Docker)
- Postgres

So when you type a username/password in the preview, the login form POSTs to `/api/auth/login`, which tries to reach the NestJS API, which tries to reach Keycloak — none of which exist in this sandbox. That's why sign-in "has many issues" here. The form rendering works; the backend behind it is absent.

**The preview URL will never authenticate. This is a platform limit, not a bug in your code.** The only way to actually test sign-in is locally (or in a real deployment).

## What I will do (once you switch to build mode)

### 1. Get you signed in locally (primary fix)

Verify and, if needed, patch these so `npm run dev` produces a working login end-to-end:

- **`docker-compose.yml`** — confirm Postgres + Keycloak services start cleanly on the expected ports.
- **`keycloak/realm-config.json`** — confirm the `lms-web` client, redirect URIs (`http://localhost:3001/callback`), and roles are imported on Keycloak boot.
- **`api/.env`** vs **`api/.env.example`** — ensure `KEYCLOAK_BASE_URL`, `KEYCLOAK_INTERNAL_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `DATABASE_URL` match what docker-compose exposes.
- **`web/.env`** vs **`web/.env.local.example`** — ensure `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEFAULT_TENANT_SUBDOMAIN`, and the backend URL used by `getBackendUrl()` are correct.
- **Seed a working user** via `api/src/scripts/seed-users.ts` / `seed-tenant.ts` so you have credentials that actually exist in Keycloak + the tenant DB.
- Write a short `LOCAL_SIGNIN.md` with the exact 4-command sequence: `docker compose up -d` → `prisma migrate deploy` → seed users → `npm run dev`, plus the demo credentials.

### 2. Harden the two most common real sign-in failure modes

From reading `api/src/auth/*` and `web/src/app/api/auth/login/route.ts`:

- **JWT issuer mismatch** — `jwt.strategy.ts` accepts both `KEYCLOAK_BASE_URL` and `KEYCLOAK_INTERNAL_URL` issuers. Verify both env vars are set in `api/.env` (missing `KEYCLOAK_INTERNAL_URL` silently breaks direct-grant login).
- **Tenant cookie** — `web/src/app/api/auth/login/route.ts` pins `NEXT_PUBLIC_DEFAULT_TENANT_SUBDOMAIN` (defaults to `"default"`). Confirm a tenant with subdomain `default` is seeded, otherwise every login 401s downstream on `/api/me`.

### 3. Tell you clearly what to do about the preview

Add a small banner on the `/login` page **only when running under a `*.lovable.app` host** that says "This preview cannot authenticate — run locally to sign in." So you're not chasing a phantom bug next time you open the preview.

## What I will NOT do

- Try to make Keycloak run inside the Lovable sandbox (not possible).
- Replace Keycloak with Lovable Cloud / Supabase auth (that's a rewrite, not a fix; only do it if you explicitly want to abandon Keycloak).
- Touch business logic — this is auth/config only.

## Deliverable

After this: `docker compose up -d && npm run dev` gives you a working login at `http://localhost:3000/login` with seeded credentials, and the preview shows a clear "run locally" notice instead of appearing broken.
