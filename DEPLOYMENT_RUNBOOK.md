# Deployment Runbook

This file is the Phase 1 rollout guide for the LMS stack.

## Targets

- `local`: developer machine with repo-owned defaults
- `shared`: shared dev or staging environment
- `production`: production-like rollout with explicit secrets and reviewed URLs

## Required Runtime Inputs

### Backend

- `DATABASE_URL`
- `API_PUBLIC_URL`
- `CORS_ORIGINS`
- `FRONTEND_APP_URL`
- `KEYCLOAK_BASE_URL`
- `KEYCLOAK_INTERNAL_URL`
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_REDIRECT_URI`

### Keycloak Admin Flows

- `KEYCLOAK_ADMIN_USER`
- `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_ADMIN_REALM`
- `KEYCLOAK_ADMIN_CLIENT_ID`

These are required for repo-owned provisioning and tenant-admin user management.

### Object Storage

- `MINIO_ENDPOINT`
- `MINIO_PUBLIC_BASE_URL`
- `MINIO_BUCKET`
- `MINIO_REGION`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`

Local development can still fall back to `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`, but shared and production environments should set explicit access and secret keys.

## Preflight

From `api/`:

```bash
npm run verify:runtime -- local
npm run verify:runtime -- shared
npm run verify:runtime -- production
```

Use `local` only on a developer machine. `shared` and `production` should pass before you deploy application code.

## Local Rollout

1. Copy `.env.example` to `.env`, `api/.env.example` to `api/.env`, and `web/.env.local.example` to `web/.env.local`.
2. Set `KEYCLOAK_CLIENT_SECRET` after provisioning or retrieving the realm client secret.
3. Start the full stack:

```bash
docker compose up -d --build
```

4. Verify:

```bash
cd api
npm run verify:runtime -- local
npm test
npm run build
npm run test:live

cd ../web
npm run build
npm run test:acceptance
```

## Shared Or Staging Rollout

1. Prepare reviewed values for:
   - public app URL
   - public API URL
   - Keycloak public URL
   - Keycloak internal URL
   - database URL
   - storage endpoint and public base URL
   - storage access and secret keys
2. Back up the database or confirm snapshot coverage.
3. Run preflight:

```bash
cd api
npm run verify:runtime -- shared
```

4. Apply database migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

5. Provision or reconcile Keycloak:

```bash
npm run provision:keycloak
```

6. Deploy the application containers or processes.
7. Smoke test:
   - `/docs`
   - `/docs-json`
   - login redirect to Keycloak
   - `/me`
   - profile update
   - avatar upload
   - admin user create, role update, deactivate

## Production Rollout

1. Run the same sequence as staging first.
2. Require explicit values for all public URLs and storage credentials.
3. Run preflight:

```bash
cd api
npm run verify:runtime -- production
```

4. Confirm:
   - DB backup or snapshot exists
   - Keycloak admin credentials are valid
   - object storage bucket exists or can be created by the app credentials
   - `KEYCLOAK_REDIRECT_URI` matches the production frontend callback URL exactly
   - `CORS_ORIGINS` matches the production frontend origin set
5. Apply migrations with:

```bash
npx prisma migrate deploy
```

6. Provision Keycloak with:

```bash
npm run provision:keycloak
```

7. Deploy the new app version.
8. Smoke test the same user flows as staging before broad traffic exposure.

## Notes

- The API now standardizes success responses as `{ data, meta }` and errors as `{ error }`.
- The Next.js proxy layer unwraps successful backend responses for the current UI.
- The local stack still has a machine-specific `podman-compose` caveat in this repo history; if services remain in `Created`, direct `podman start` may still be required on this machine.
