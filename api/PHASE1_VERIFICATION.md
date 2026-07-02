# Phase 1 Verification

This file records the current Phase 1 backend contract and the minimum verification path for the LMS repo.

## Run Commands

From `api/`:

```bash
npm run verify:runtime -- local
npm run provision:keycloak
npx prisma generate
npm test
npm run build
npm run test:live
```

From `web/`:

```bash
npm run build
npm run test:acceptance
```

From repo root for the full local stack:

```bash
docker compose up -d --build
```

## Required Environment Notes

- API runtime now reads both `api/.env` and the repo root `.env`
- Example env templates now exist in `.env.example`, `api/.env.example`, and `web/.env.local.example`
- Repo-owned rollout guidance now lives in `DEPLOYMENT_RUNBOOK.md`
- Deployment-facing runtime knobs now include `API_PUBLIC_URL`, `HOST`, `CORS_ORIGINS`, `FRONTEND_APP_URL`, `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_REDIRECT_URI`, `MINIO_ENDPOINT`, and `MINIO_PUBLIC_BASE_URL`
- Storage config now prefers explicit `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`, while localhost-style MinIO defaults are treated as local-development fallbacks only
- Swagger reachability is now explicit in code through `/docs` and `/docs-json`; the fresh build served both with `200` on a clean process after the explicit JSON route was added
- Repo-owned Keycloak realm/client provisioning now lives in:
  - `keycloak/realm-config.json`
  - `api/src/scripts/keycloak-provisioning.ts`
  - `api/src/scripts/provision-keycloak.ts`
- `docker-compose.yml` now includes `api`, `web`, and `keycloak-provisioner` in addition to the infra services
- Swagger/OpenAPI baseline now exists at `/docs` with the JSON document exposed at `/docs-json`
- Successful backend responses are now standardized as `{ data, meta }`, and backend errors now use a shared `{ error }` shape
- Tenant-aware API calls must resolve a tenant through one of:
  - `x-tenant-id`
  - `x-tenant-subdomain`
  - hostname subdomain
- Web proxy routes now resolve tenant from a persisted `tenant_subdomain` cookie, the current hostname, or the local default subdomain as a final local-only fallback
- Admin user management routes require:
  - `KEYCLOAK_ADMIN_USER`
  - `KEYCLOAK_ADMIN_PASSWORD`
  - optional overrides for `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_REALM`, and `KEYCLOAK_ADMIN_CLIENT_ID`

## Contract Baseline

### `GET /me`

- Requires a valid Bearer token
- Requires tenant resolution
- Creates a local user when `keycloakId` is not found
- Rejects inactive users
- Rejects users whose stored `tenantId` differs from the resolved tenant
- Syncs local `email` and `roles` from the Keycloak token for active users

### `GET /users`

- Requires `admin` role
- Returns users scoped to the resolved tenant

### `POST /users`

- Requires `admin` role
- Creates the user in Keycloak first
- Persists the LMS user with the resolved tenant
- Rejects duplicate local emails

Expected body:

```json
{
  "email": "admin@example.com",
  "temporaryPassword": "Temp123!",
  "roles": ["admin"],
  "firstName": "Admin",
  "lastName": "User"
}
```

### `PATCH /users/:id`

- Requires `admin` role
- Resolves the target user within the current tenant
- Syncs realm roles in Keycloak before updating local roles

Expected body:

```json
{
  "roles": ["instructor"]
}
```

### `PATCH /users/:id/deactivate`

- Requires `admin` role
- Resolves the target user within the current tenant
- Disables the user in Keycloak
- Persists `isActive=false` locally

## Automated Coverage Present

- `api/src/app.controller.spec.ts`
  - `/me` bootstrapping and tenant/inactive guards
- `api/src/auth/roles.guard.spec.ts`
  - route-level role decisions
- `api/src/tenant/tenant.service.spec.ts`
  - tenant resolution priority and strict fallback behavior
- `api/src/user/user.service.spec.ts`
  - tenant-scoped admin create/update/deactivate behavior
- `api/test/live-auth.acceptance.ts`
  - live Keycloak-backed `/me`, `/users`, profile update, and avatar upload flow against the local stack
- `web/e2e/dashboard.acceptance.spec.ts`
  - real browser coverage for dashboard load, profile save, avatar upload, admin user create/update/deactivate, tenant-cookie-backed proxying, and forced re-login after session expiry
- Next.js proxy routes unwrap successful backend envelopes before returning to the React UI, so the current frontend data expectations remain stable during the Phase 1 handoff

## Live Acceptance Notes

- `npm run test:live` expects:
  - local PostgreSQL reachable at `localhost:5432`
  - local Keycloak reachable at `localhost:8080`
  - local MinIO reachable at `localhost:9000` for avatar upload coverage
  - valid `api/.env` plus root `.env`
- `npm run provision:keycloak` provisions the repo-owned LMS realm/client/roles shape before app or acceptance startup
- `docker compose up -d --build` now builds and starts the full local stack, including Keycloak provisioning and app containers
- The script provisions a realm/client shape if needed, creates disposable test users in Keycloak, boots the Nest app in-process, and exercises:
  - `GET /me`
  - `PATCH /me/profile`
  - `POST /me/avatar`
  - `GET /users` authz failure for a learner
  - `POST /users`
  - `PATCH /users/:id`
  - `PATCH /users/:id/deactivate`

## Current Gaps

- Shared/staging/production rollout still depends on environment-specific reviewed values, but the repo now includes a preflight command and deployment runbook
