# Signing in locally

> **The Lovable preview cannot sign you in.** This project is a Next.js + NestJS + Keycloak + Postgres monorepo. The Lovable sandbox runs a single Vite app on port 8080 only — it does not host the Next.js frontend, the NestJS API, Keycloak, or Postgres. Every sign-in attempt in the preview will fail because the backend it needs is not running there. Run it locally (or deploy per `DEPLOYMENT_RUNBOOK.md`) to actually authenticate.

## One-time setup

```bash
cp api/.env.example api/.env
cp web/.env.local.example web/.env.local
```

Edit `api/.env` and set a real value for `KEYCLOAK_CLIENT_SECRET`. Any random string works for local dev — the provisioner writes it into Keycloak.

## Start everything

```bash
# 1. Backing services (Postgres, Redis, Keycloak, MinIO)
docker compose up -d postgres redis keycloak minio

# 2. Apply DB migrations
cd api && npx prisma migrate deploy && cd ..

# 3. Provision the Keycloak realm/client (creates realm "LMS" + client "lms-web")
cd api && npx ts-node -r tsconfig-paths/register src/scripts/provision-keycloak.ts && cd ..

# 4. Seed the default tenant
cd api && npx ts-node -r tsconfig-paths/register src/scripts/seed-tenant.ts && cd ..

# 5. Seed the demo users into Keycloak + DB
cd api && npx ts-node -r tsconfig-paths/register src/scripts/seed-users.ts && cd ..

# 6. Run the app
npm run dev
```

Web: <http://localhost:3001>  •  API: <http://localhost:3000>  •  Keycloak: <http://localhost:8080>

## Demo credentials

All demo users share the password **`Admin@1234`**.

| Email                     | Roles                          |
| ------------------------- | ------------------------------ |
| `super.admin@lms.dev`     | super_admin, admin, instructor, learner |
| `admin@lms.dev`           | admin, learner                 |
| `instructor@lms.dev`      | instructor, learner            |
| `learner@lms.dev`         | learner                        |

## If sign-in still fails locally

1. **`Invalid username or password`** → the user was not seeded. Re-run step 5.
2. **401 on `/api/me` after login** → the `default` tenant is missing. Re-run step 4.
3. **`issuer invalid` in API logs** → `KEYCLOAK_BASE_URL` is not set in `api/.env`. Fix and restart `api`.
4. **Keycloak returns `invalid_client`** → `KEYCLOAK_CLIENT_SECRET` in `api/.env` doesn't match what the provisioner wrote. Re-run step 3 (it upserts the secret).
5. **Network error / CORS** → check `CORS_ORIGINS` in `api/.env` includes `http://localhost:3001`.