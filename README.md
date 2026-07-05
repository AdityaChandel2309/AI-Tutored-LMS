# LMS Platform

Enterprise workforce intelligence & knowledge platform.
**Stack:** Next.js 15 (`web/`) + NestJS 11 (`api/`) + Prisma/Postgres + Keycloak + MinIO + Redis, orchestrated with Turborepo.

> The Lovable sandbox preview cannot run this app end-to-end (multi-service). Run it locally with Docker as described below, or deploy per `DEPLOYMENT_RUNBOOK.md`.

---

## Quickstart

Prerequisites: Node 20+, npm 10+, Docker Desktop.

```bash
# 1. Install deps (root — Turborepo installs both workspaces)
npm install

# 2. Env files
cp api/.env.example api/.env
cp web/.env.local.example web/.env.local
#    -> set KEYCLOAK_CLIENT_SECRET in api/.env (any random string; the
#       provisioner writes it into Keycloak in step 5).

# 3. Backing services
docker compose up -d postgres redis keycloak minio

# 4. Database migrations
cd api && npx prisma migrate deploy && cd ..

# 5. Provision Keycloak realm + client + demo users, seed default tenant
cd api
npx ts-node -r tsconfig-paths/register src/scripts/provision-keycloak.ts
npx ts-node -r tsconfig-paths/register src/scripts/seed-tenant.ts
npx ts-node -r tsconfig-paths/register src/scripts/seed-users.ts
cd ..

# 6. (Recommended) Rich demo content for every role
cd api && npm run seed:demo && cd ..
#    -> re-run any time; add `-- --reset` to wipe demo courses/projects/docs first.

# 7. (Recommended) Vector embeddings for the AI Knowledge Assistant
cd api && npm run backfill:document-embeddings && cd ..

# 8. Run everything
npm run dev            # turbo: web on :3001, api on :3000
```

URLs: **Web** http://localhost:3001 · **API** http://localhost:3000 · **API docs** http://localhost:3000/docs · **Keycloak** http://localhost:8080 · **MinIO** http://localhost:9001

### Demo credentials

All demo users share the password **`Admin@1234`**.

| Email                     | Roles                                        | What they see after `seed:demo` |
| ------------------------- | -------------------------------------------- | ------------------------------- |
| `super.admin@lms.dev`     | super_admin, admin, instructor, learner      | 4 synthetic direct reports for team analytics; owns 3 demo projects |
| `admin@lms.dev`           | admin, learner                               | Platform-wide analytics: 7 published courses, ~20 enrollments, 6 certificates, 4 knowledge docs, audit log |
| `instructor@lms.dev`      | instructor, learner                          | 5 authored courses + a completed enrollment + review notifications |
| `learner@lms.dev`         | learner                                      | 5 enrollments (2 completed w/ certs, 2 in-progress, 1 new), quiz attempts, 4 notifications |

---

## Repository layout

```
api/                NestJS 11 backend (Prisma, Keycloak JWT, per-request tenant scope)
  src/scripts/      Idempotent seed + provisioning scripts (see below)
  prisma/           Schema + migrations
web/                Next.js 15 App Router frontend (TanStack Query, typed API client)
  e2e/              Playwright acceptance specs
docker/             Local dockerfiles
docker-compose.yml  Postgres + Redis + Keycloak + MinIO
docs/               Living documentation
  archive/          Historical handoff notes (PROJECT_CONTEXT, HANDOFF_TO_ANTIGRAVITY, PHASE1_CHECKLIST, LOCAL_SIGNIN)
scripts/            Root build helpers (assemble-dist)
DEPLOYMENT_RUNBOOK.md   Staging / prod rollout
```

---

## Common commands

```bash
npm run dev                      # both workspaces in parallel
npm run dev --workspace=web      # just the frontend
npm run dev --workspace=api      # just the backend
npm run build                    # turbo build (prisma generate + nest build + next build)
npm run lint                     # turbo lint

cd api
npx prisma migrate dev           # create+apply a new migration
npx prisma studio                # DB inspector
npm run seed:demo                # rich demo content (idempotent; `-- --reset` to wipe first)
npm run backfill:document-embeddings   # populate vector embeddings for knowledge docs
npm test                         # jest unit tests

cd web
bunx tsgo --noEmit               # fast typecheck (Playwright e2e types included)
bun run test:e2e                 # Playwright acceptance (requires full stack running)
```

---

## Troubleshooting sign-in

1. **`Invalid username or password`** — users not seeded. Re-run `seed-users.ts`.
2. **401 on `/api/me`** — default tenant missing. Re-run `seed-tenant.ts`.
3. **`issuer invalid` in API logs** — `KEYCLOAK_BASE_URL` unset in `api/.env`.
4. **Keycloak `invalid_client`** — `KEYCLOAK_CLIENT_SECRET` drifted. Re-run `provision-keycloak.ts` (upserts the secret).
5. **CORS / network error** — `CORS_ORIGINS` in `api/.env` must include `http://localhost:3001`.
6. **No users visible in Keycloak admin** — switch the realm dropdown from **master** to **LMS**.

---

## Feature highlights

- **Courses**: authoring workflow (draft -> published), modules, lessons (video, text, quiz, SCORM, assignment), auto-completion (video @ 90%, text via IntersectionObserver + dwell, quiz on pass), progress tracking, xAPI-style `/courses/complete-lesson`.
- **Assessments**: question bank editor, timed quiz runner with question navigator + review-before-submit, tokenized result cards.
- **Certificates**: issued on completion; learner dashboard supports copy-code + Web Share; public `/verify/[code]` page for third-party verification.
- **Knowledge Assistant (RAG)**: PDF/text extraction, chunked embeddings, cited answers with source-doc preview drawer and copy-answer.
- **Video player**: resume position (localStorage), playback speed, optional captions track, mark-complete at 90%.
- **Projects**: Kanban board with milestone progress bar and overdue indicators.
- **Notifications**: bell + dedicated `/dashboard/notifications` page, mark-all-read, semantic tones.
- **Analytics**: role-scoped dashboards (learner / instructor / admin / super_admin).
- **Downloadable resources**: presigned MinIO uploads per lesson with enrollment-gated downloads.
- **Multi-tenant**: subdomain-scoped tenant resolution, per-tenant seed + Keycloak realm.

---

## Further reading

- `docs/ARCHITECTURE.md` — system overview, diagram, security layers
- `docs/ADR.md` — architecture decision records
- `docs/RBAC_MATRIX.md` — endpoint × role access matrix and module ownership
- `docs/HARDENING_TASKS.md` — enterprise hardening task tracker
- `DEPLOYMENT_RUNBOOK.md` — staging / production rollout
- `docs/archive/` — historical phase-by-phase context and handoff notes
- `api/prisma/schema.prisma` — canonical data model
- API docs (Swagger) — http://localhost:3000/docs when the API is running
