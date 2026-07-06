<div align="center">

# 🎓 LMS Platform

**Enterprise workforce intelligence & knowledge platform.**

A multi-tenant Learning Management System with courses, assessments, certificates, projects, an AI Knowledge Assistant (RAG), and role-scoped analytics.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Keycloak](https://img.shields.io/badge/Auth-Keycloak-4D4D4D?logo=keycloak)](https://www.keycloak.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?logo=turborepo)](https://turbo.build/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

</div>

---

## 📑 Table of contents

- [Overview](#-overview)
- [Tech stack](#-tech-stack)
- [Feature highlights](#-feature-highlights)
- [Cloning the repository](#-cloning-the-repository)
- [Quickstart](#-quickstart)
- [Demo credentials](#-demo-credentials)
- [Repository layout](#-repository-layout)
- [Common commands](#-common-commands)
- [Environment variables](#-environment-variables)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Further reading](#-further-reading)
- [License](#-license)

---

## 🧭 Overview

LMS Platform is an enterprise-grade, multi-tenant learning and knowledge system. It combines classic LMS building blocks (courses, modules, lessons, quizzes, SCORM, certificates) with modern workforce features (projects, org structure, notifications, audit log) and an AI Knowledge Assistant that answers questions from your uploaded documents using retrieval-augmented generation.

> ⚠️ The Lovable sandbox preview cannot run this app end-to-end (multi-service). Run it locally with Docker as described below, or deploy per [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md).

---

## 🧱 Tech stack

| Layer          | Technology                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router), React 19, TanStack Query, TypeScript, Tailwind    |
| Backend        | NestJS 11, TypeScript, Prisma ORM, Zod                                     |
| Database       | PostgreSQL 16 (+ pgvector for embeddings)                                  |
| Auth           | Keycloak (OIDC) with per-tenant realm support                              |
| Storage        | MinIO (S3-compatible) for avatars, videos, SCORM, lesson resources         |
| Cache / queues | Redis                                                                      |
| AI / RAG       | Pluggable LLM gateway + vector embeddings for the Knowledge Assistant      |
| Tooling        | Turborepo, Docker Compose, Playwright, Jest                                |

---

## ✨ Feature highlights

- **Courses** — draft → published workflow, modules, lessons (video, text, quiz, SCORM, assignment), auto-completion (video @ 90%, text via IntersectionObserver + dwell, quiz on pass), xAPI-style `/courses/complete-lesson`.
- **Assessments** — question bank editor, timed quiz runner with question navigator + review-before-submit, tokenized result cards.
- **Certificates** — issued on completion; learner dashboard supports copy-code + Web Share; public `/verify/[code]` page for third-party verification.
- **Knowledge Assistant (RAG)** — PDF/text extraction, chunked embeddings, cited answers with source-doc preview drawer and copy-answer.
- **Video player** — resume position, playback speed, optional captions track, mark-complete at 90%.
- **Projects** — Kanban board with milestone progress bar and overdue indicators.
- **Notifications** — bell + dedicated `/dashboard/notifications` page, mark-all-read, semantic tones.
- **Analytics** — role-scoped dashboards (learner / instructor / admin / super_admin).
- **Downloadable resources** — presigned MinIO uploads per lesson with enrollment-gated downloads.
- **Multi-tenant** — subdomain-scoped tenant resolution, per-tenant seed + Keycloak realm.

---

## 📥 Cloning the repository

### Prerequisites

| Tool           | Version  |
| -------------- | -------- |
| Git            | 2.30+    |
| Node.js        | 20+      |
| npm            | 10+      |
| Docker Desktop | latest   |

### Clone with HTTPS

```bash
git clone https://github.com/<your-org>/<your-repo>.git lms-platform
cd lms-platform
```

### Clone with SSH

```bash
git clone git@github.com:<your-org>/<your-repo>.git lms-platform
cd lms-platform
```

### Clone with GitHub CLI

```bash
gh repo clone <your-org>/<your-repo> lms-platform
cd lms-platform
```

### Fork & contribute workflow

```bash
# 1. Fork on GitHub, then clone your fork
git clone git@github.com:<your-username>/<your-repo>.git lms-platform
cd lms-platform

# 2. Add the upstream remote to pull in future changes
git remote add upstream git@github.com:<your-org>/<your-repo>.git
git fetch upstream

# 3. Create a feature branch off main
git checkout -b feat/my-change

# 4. Keep your branch in sync
git fetch upstream && git rebase upstream/main
```

Once cloned, continue with [Quickstart](#-quickstart) below.

---

## 🚀 Quickstart

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

### Service URLs

| Service   | URL                                |
| --------- | ---------------------------------- |
| Web       | http://localhost:3001              |
| API       | http://localhost:3000              |
| API docs  | http://localhost:3000/docs (Swagger) |
| Keycloak  | http://localhost:8080              |
| MinIO     | http://localhost:9001              |

---

## 👥 Demo credentials

All demo users share the password **`Admin@1234`**.

| Email                     | Roles                                        | What they see after `seed:demo` |
| ------------------------- | -------------------------------------------- | ------------------------------- |
| `super.admin@lms.dev`     | super_admin, admin, instructor, learner      | 4 synthetic direct reports for team analytics; owns 3 demo projects |
| `admin@lms.dev`           | admin, learner                               | Platform-wide analytics: 7 published courses, ~20 enrollments, 6 certificates, 4 knowledge docs, audit log |
| `instructor@lms.dev`      | instructor, learner                          | 5 authored courses + a completed enrollment + review notifications |
| `learner@lms.dev`         | learner                                      | 5 enrollments (2 completed w/ certs, 2 in-progress, 1 new), quiz attempts, 4 notifications |

---

## 📁 Repository layout

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

## 🛠️ Common commands

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

## 🔐 Environment variables

Copy the example files and fill in secrets before running the stack:

```bash
cp api/.env.example api/.env
cp web/.env.local.example web/.env.local
```

Key variables (see the `.env.example` files for the full list):

| Variable                     | Where       | Purpose                                       |
| ---------------------------- | ----------- | --------------------------------------------- |
| `DATABASE_URL`               | api         | Postgres connection string                    |
| `KEYCLOAK_BASE_URL`          | api / web   | Public Keycloak URL (OIDC issuer)             |
| `KEYCLOAK_INTERNAL_URL`      | api         | In-cluster Keycloak URL for token validation  |
| `KEYCLOAK_CLIENT_SECRET`     | api         | OIDC client secret (provisioner writes it)    |
| `MINIO_ENDPOINT`             | api         | S3-compatible object storage endpoint         |
| `MINIO_ACCESS_KEY` / `SECRET_KEY` | api    | MinIO credentials                             |
| `CORS_ORIGINS`               | api         | Comma-separated allow-list (include `:3001`)  |
| `LLM_API_KEY` / `LLM_API_URL`| api         | Knowledge Assistant provider config           |
| `NEXT_PUBLIC_API_BASE_URL`   | web         | Public API base URL for the browser           |
| `API_INTERNAL_URL`           | web         | SSR/proxy API base                            |

> 🔒 **Never commit real secrets.** `.env` / `.env.local` are git-ignored.

---

## 🧪 Testing

```bash
# API unit tests
cd api && npm test

# Web typecheck
cd web && bunx tsgo --noEmit

# Web Playwright end-to-end (requires the full stack running)
cd web && bun run test:e2e
```

---

## 🚢 Deployment

- **Single-VM with Docker Compose + Nginx** — see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).
- **Staging / production runbook** — see [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md).
- **Smoke tests** — `bash scripts/smoke-test.sh http://localhost`.

---

## 🩺 Troubleshooting

1. **`Invalid username or password`** — users not seeded. Re-run `seed-users.ts`.
2. **401 on `/api/me`** — default tenant missing. Re-run `seed-tenant.ts`.
3. **`issuer invalid` in API logs** — `KEYCLOAK_BASE_URL` unset in `api/.env`.
4. **Keycloak `invalid_client`** — `KEYCLOAK_CLIENT_SECRET` drifted. Re-run `provision-keycloak.ts` (upserts the secret).
5. **CORS / network error** — `CORS_ORIGINS` in `api/.env` must include `http://localhost:3001`.
6. **No users visible in Keycloak admin** — switch the realm dropdown from **master** to **LMS**.

---

## 🤝 Contributing

Contributions are welcome! To propose a change:

1. Fork the repo and create a feature branch (`git checkout -b feat/my-change`).
2. Make your changes with clear commit messages.
3. Run `npm run lint` and the relevant tests.
4. Open a pull request against `main`, describing what and why.

For larger changes, open an issue first to discuss the approach.

---

## 📚 Further reading

- `docs/ARCHITECTURE.md` — system overview, diagram, security layers
- `docs/ADR.md` — architecture decision records
- `docs/RBAC_MATRIX.md` — endpoint × role access matrix and module ownership
- `docs/HARDENING_TASKS.md` — enterprise hardening task tracker
- `DEPLOYMENT_RUNBOOK.md` — staging / production rollout
- `docs/archive/` — historical phase-by-phase context and handoff notes
- `api/prisma/schema.prisma` — canonical data model
- API docs (Swagger) — http://localhost:3000/docs when the API is running

---

## 📄 License

Released under the [MIT License](./LICENSE). If no `LICENSE` file is present, the project is currently unlicensed — add one before public distribution.
