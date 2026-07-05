# API (`@lms/api`)

NestJS 11 + Prisma backend for the LMS platform. Multi-tenant, Keycloak-authenticated, event-driven.

> **First-time setup lives in the root `../README.md`.** Run `npm run bootstrap` there before touching this workspace directly. This file only covers day-to-day API work.

## Quick start (this workspace only)

```bash
# from repo root
npm install

# from api/
cp .env.example .env                      # then edit KEYCLOAK_CLIENT_SECRET etc.
npx prisma migrate deploy                 # apply migrations
npx prisma generate                       # regenerate client
npm run start:dev                         # nest watch mode on :3000
```

Swagger UI: <http://localhost:3000/docs>. Health probe: <http://localhost:3000/health>.

## Common scripts

```bash
npm run start:dev                         # nest watch
npm run build                             # prisma generate + nest build
npm test                                  # jest unit tests
npm run test:e2e                          # jest e2e (needs full stack)
npm run lint

npx prisma migrate dev --name <slug>      # create + apply a new migration
npx prisma studio                         # DB inspector on :5555

npm run seed:demo                         # rich idempotent demo data (add `-- --reset` to wipe first)
npm run backfill:document-embeddings      # populate vector embeddings for RAG
```

## Layout

```
src/
  auth/                Keycloak token exchange, JWT + JWKS validation
  tenant/              Subdomain → tenant middleware and guard
  user/  app/          Users, roles, profile (/me)
  course/  module/  lesson/  lesson-resource/
                       Course authoring + delivery
  category/            Course categorisation
  progress/  assessment/  certificate/
                       Learner flows: progress, quizzes, credentials
  video/  scorm/  storage/
                       Media upload + delivery (presigned MinIO)
  knowledge/  document-embedding/  knowledge-assistant/
                       Enterprise document library + RAG Q&A
  ai-tutor/            Course-scoped conversational tutor
  notification/        In-app notifications + event listeners
  organization/  employee/  project/
                       HR + delivery data
  analytics/  audit/   Reporting and governance
  events/              EventBus (nest event-emitter wrapper)
  common/              Shared guards, decorators, filters, pipes
  config/              Env validation, feature flags, runtime helpers
  scripts/             Idempotent seeds + Keycloak provisioning
  health/              Liveness / readiness probes
prisma/
  schema.prisma        Canonical data model
  migrations/          Ordered SQL migrations
test/                  E2E specs + jest config
```

## Key environment variables

See `.env.example` for the full list. The essentials:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `KEYCLOAK_BASE_URL` / `KEYCLOAK_REALM` / `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_CLIENT_SECRET` | OIDC provider |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | S3-compatible object storage |
| `CORS_ORIGINS` | Comma-separated allowlist (must include the web origin) |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | OpenAI-compatible LLM (AI Tutor + Knowledge Assistant) |
| `EMBEDDING_MODEL` | Embedding model for RAG |
| `FEATURE_*` | Toggle optional modules (AI, SCORM, certificates, …) |

## Further reading

- `../README.md` — repo entry point + Quickstart
- `../docs/ARCHITECTURE.md` — system diagram, modules, security layers
- `../docs/RBAC_MATRIX.md` — endpoint × role access matrix
- `../docs/ADR.md` — architecture decision records
- `../DEPLOYMENT_RUNBOOK.md` — staging / production rollout