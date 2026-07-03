# Phase 1 Checklist

This file tracks Phase 1 of the LMS implementation plan against the current repository state.

## Scope

Phase 1 target from the implementation plan:

- Monorepo + Docker + Keycloak + DB init
- Auth flow + user CRUD + protected routes
- Multi-tenant foundation
- Frontend shell + design system baseline

## Status Summary

### Done

- `web/` Next.js frontend and `api/` NestJS backend both exist
- Local infra services for PostgreSQL, Redis, Keycloak, and MinIO exist in `docker-compose.yml`
- Keycloak authorization code exchange exists in `api/src/auth/auth.controller.ts`
- JWT validation via JWKS exists in `api/src/auth/jwt.strategy.ts`
- Authenticated request context now includes `tenantId` when the user exists in the LMS database
- Protected API routes exist via `JwtAuthGuard` and `RolesGuard`
- `GET /me` provisions or updates the LMS user from the Keycloak token in `api/src/app.controller.ts`
- Prisma schema and migrations exist for `User` and `Tenant`
- The local `lms` database now has all committed Prisma migrations applied
- Default tenant seed script exists in `api/src/scripts/seed-tenant.ts`
- Tenant resolution middleware now exists with `x-tenant-id`, `x-tenant-subdomain`, and subdomain lookup support
- Admin user create, read, role sync, and deactivate routes now exist and are tenant-scoped in the service layer
- Frontend callback stores issued tokens and redirects to dashboard
- Dashboard loads the current user and conditionally renders admin UI based on roles
- Logout flow exists on the frontend
- Next.js route protection now exists via `web/src/proxy.ts`
- Tenant ownership is now required in the Prisma model and backed by a migration that fills legacy gaps safely
- Tenant resolution is now strict by default, with support for `x-tenant-subdomain`, real subdomains, and optional explicit dev fallback config
- Tenant resolution unit tests now exist in `api/src/tenant/tenant.service.spec.ts`
- Backend verification baseline now exists in `api/PHASE1_VERIFICATION.md`
- Auth, tenant, RBAC, `/me`, and admin user service behavior now have Jest coverage in the backend
- Admin UI now supports user listing, creation, role changes, and deactivation against the backend API
- Frontend session handling now uses Next.js API routes plus `HttpOnly` cookies instead of client-managed bearer tokens for dashboard and admin traffic
- Frontend session proxies now retry once with the refresh token and rotate cookies when the access token has expired
- Live auth and tenant acceptance coverage now exists via `api/test/live-auth.acceptance.ts` and passes against the local Keycloak/Postgres stack
- Profile editing and MinIO-backed avatar upload now exist in the backend, frontend dashboard, and live acceptance coverage
- Expired-session UX now redirects users back to login with a specific `session-expired` state instead of a generic bounce
- Frontend browser acceptance coverage now exists for dashboard, profile, avatar, admin user flows, and forced re-login behavior
- API runtime env loading now reads both `api/.env` and the repo root `.env`, fixing MinIO and admin/runtime credential drift when the server boots from `api/`
- API auth, JWT issuer/JWKS config, CORS, host/port binding, and public URL logging are now env-driven instead of being pinned to localhost-only values
- Repo-owned env templates now exist for root, API, and web configuration bootstrapping
- Repo-owned Keycloak realm/client provisioning now exists through `keycloak/realm-config.json` plus `npm run provision:keycloak`
- `docker-compose.yml` now includes `api`, `web`, and a one-shot `keycloak-provisioner` service so the full local stack can be started from Compose-backed images
- Swagger/OpenAPI baseline now exists in the API bootstrap and route decorators, with shared DTO examples for auth, profile, and user management flows
- Design-system baseline now includes shared `Badge` and `Field` primitives plus a baseline reference file in `web/DESIGN_SYSTEM_BASELINE.md`
- Local tenant handling in the web app now persists a tenant preference cookie, infers tenant from hostname, and only falls back to the default tenant for true local-host development
- API responses are now standardized behind a global success envelope plus shared error shape in the Nest app, while the Next.js proxy layer unwraps success payloads for existing UI consumers
- Design-system coverage now includes shared `Select`, `Notice`, `SectionHeading`, and `Stat` primitives plus a stronger page-level visual shell across login, dashboard, profile, and admin surfaces
- Storage/runtime handling now centralizes MinIO config behind runtime helpers, supports explicit access/secret keys, and restricts localhost-style storage defaults to local development
- Repo-owned rollout guidance now exists in `DEPLOYMENT_RUNBOOK.md`, and `api` now exposes `npm run verify:runtime -- <local|shared|production>` for deployment preflight checks
- Swagger JSON reachability is now explicit in the API bootstrap, and the web app now uses `proxy.ts` instead of the deprecated `middleware.ts` convention

### Partially Done

- Multi-tenancy now has request-level resolution and non-null ownership, but the frontend still uses a local default-tenant fallback when no cookie or hostname tenant is available
- Design system is now materially broader, but still not a full productized system with navigation, dialogs, and richer composition primitives
- Docker Compose now includes the app surfaces, but startup behavior on this machine still needed a `podman` fallback after `podman-compose` left created containers pending
- RBAC exists at route level, but role and permission modeling is still thin
- Verification now covers key backend behavior, live auth acceptance, real frontend browser flows, and a healthy local container stack
- Local database migration state is current, but shared/staging/production rollout still needs an environment-specific deploy process
- Session handling now includes user-facing expiry messaging, but it still lacks more advanced policies such as refresh rotation checks
- Profile UX now exists, but the object-storage path still depends on local/default MinIO configuration conventions

### Missing

- Monorepo orchestration such as Turborepo or Nx

## Current Gaps That Matter First

1. Design system still lacks navigation, dialog/toast patterns, and broader composition rules.
2. Shared/staging/production environments still need reviewed environment values and final operator execution, even though the repo now contains the runbook and preflight tooling.

## Recommended Execution Order

1. Continue design-system expansion only if you want more product-level UI primitives before Phase 2.
2. Use the new rollout runbook and preflight command when you prepare a real shared/staging/production deployment.

## Phase Gate View

### G1 Architecture Review

- `partial`: Core auth/data structure exists, tenant ownership is stricter, and local tenant ergonomics are less header-driven, but Phase 1 boundaries are not fully codified.

### G2 Security Review

- `partial`: OIDC and JWT validation exist, protected-route coverage exists, tenant isolation is stricter, session handling now includes refresh recovery plus expired-session UX, runtime config is more deployable, and the API now has a consistent response contract, but some product polish remains.

### G3 QA Approval

- `partial`: Backend verification baseline, live acceptance coverage, frontend browser acceptance coverage, runtime hardening, local tenant preference coverage, response-contract standardization, and stronger UI baseline coverage now exist, but some UI/system polish remains.

### G4 Product Approval

- `partial`: Login and dashboard basics work, tenant admin UI exists, profile flows now exist, local tenant selection is more usable, and the shared visual baseline is stronger, but higher-polish UX is still incomplete.

### G5 Deployment Readiness

- `partial`: Infra services exist locally, runtime config is less localhost-bound, Keycloak provisioning is repo-owned, Compose includes app containers, docs/response-contract/design baselines exist, storage config is stricter, and repo-owned rollout guidance now exists, but real environment rollout and UI/system polish remain.
