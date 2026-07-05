# Architecture Documentation

## System Overview

The LMS is a multi-tenant enterprise learning management system built for GAIL (Gas Authority of India Limited). It provides course management, assessments, certifications, employee management, project tracking, and AI-powered learning assistance.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS, TanStack Query |
| Backend | NestJS 11, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| Auth | Keycloak (OIDC/JWT) |
| Storage | MinIO (S3-compatible) |
| AI | OpenAI-compatible LLM API (chat + embeddings for RAG) |
| Cache / Queue | Redis |
| Containerization | Docker, Docker Compose |
| CI | GitHub Actions |
| Monorepo | Turborepo (workspaces: `api/`, `web/`) |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js Web (port 3001)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ App Router  │  │ API Routes   │  │ Server Session     │  │
│  │ (Pages)     │  │ (Proxy)      │  │ (Cookie Auth)      │  │
│  └─────────────┘  └──────┬───────┘  └───────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (internal)
┌──────────────────────────▼──────────────────────────────────┐
│              NestJS API (port 3000)                           │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────┐  │
│  │ Guards   │ │ Services │ │ Events  │ │ AI (LlmClient)│  │
│  │ (Auth,   │ │ (Domain  │ │ (Event  │ │ (Tutor,       │  │
│  │  Tenant, │ │  Logic)  │ │  Bus)   │ │  Knowledge)   │  │
│  │  Throttle│ │          │ │         │ │               │  │
│  └──────────┘ └──────────┘ └─────────┘ └───────────────┘  │
└───────┬──────────────┬──────────────────────┬───────────────┘
        │              │                      │
   ┌────▼────┐   ┌────▼────┐          ┌─────▼─────┐
   │PostgreSQL│   │  MinIO  │          │ Keycloak  │
   │(Prisma)  │   │  (S3)   │          │ (OIDC)    │
   └──────────┘   └─────────┘          └───────────┘
```

## Multi-Tenancy

- Tenant resolution via subdomain (middleware)
- All data models include `tenantId` foreign key
- Global `TenantGuard` rejects authenticated requests without resolved tenant
- Services enforce `tenantId` in all queries (throw ForbiddenException if null)

## Authentication Flow

1. Browser redirects to Keycloak login
2. Keycloak returns authorization code to `/callback`
3. Web exchanges code via API `/auth/exchange`
4. API returns tokens, web stores in httpOnly cookies
5. Subsequent requests: web proxies to API with Bearer token
6. API validates JWT via `passport-jwt` + JWKS

## Security Layers

| Layer | Mechanism |
|-------|-----------|
| Rate Limiting | `@nestjs/throttler` — global 20/s, 100/min; auth 5/min; AI 10/min |
| Authentication | JWT (Keycloak JWKS validation) |
| Authorization | Role-based guards (`@Roles()` decorator) |
| Tenant Isolation | Global TenantGuard + per-service enforcement |
| Upload Validation | FileValidationPipe (MIME, extension, size) |
| AI Safety | Prompt injection detection, system prompt guard, input length limits |
| Feature Flags | Environment-driven (`FEATURE_*` env vars) |

## Event System

- `EventBus` wraps `@nestjs/event-emitter`
- Domain events emitted by services (enrollment, completion, etc.)
- `AnalyticsListener` persists events to `AnalyticsEvent` table
- Decoupled: event dispatch never blocks the main request

## Observability

- Structured JSON logging with correlation IDs
- Request logging middleware (method, path, status, duration)
- Error logging with stack traces
- Audit logging (who did what, when, from where)

## Domain Modules

Backend modules live under `api/src/*`. Public UI lives under `web/src/app/*`.

| Module | Directory | Purpose |
|--------|-----------|---------|
| Auth | `api/src/auth/` | Keycloak token exchange, refresh, JWT validation |
| Tenant | `api/src/tenant/` | Subdomain-based tenant resolution middleware |
| User | `api/src/user/` | User CRUD, role assignment |
| Profile | `api/src/app/` | `/me`, profile updates |
| Course | `api/src/course/` | Course lifecycle, publish workflow (draft → review → published → archived) |
| Category | `api/src/category/` | Course categorisation |
| Module | `api/src/module/` | Course module ordering |
| Lesson | `api/src/lesson/` | Lesson content (video, text, quiz, SCORM, assignment) |
| Lesson Resource | `api/src/lesson-resource/` | Downloadable per-lesson attachments (presigned MinIO) |
| Progress | `api/src/progress/` | Enrollment progress, completion tracking |
| Video | `api/src/video/` | Video upload URL issuance + processing |
| SCORM | `api/src/scorm/` | SCORM package upload + runtime |
| Assessment | `api/src/assessment/` | Question bank, attempts, grading |
| Certificate | `api/src/certificate/` | Templates, issuance, public verification |
| Knowledge | `api/src/knowledge/` | Enterprise document library |
| Document Embedding | `api/src/document-embedding/` | Chunked vector embeddings for RAG |
| Knowledge Assistant | `api/src/knowledge-assistant/` | RAG Q&A over knowledge docs with citations |
| AI Tutor | `api/src/ai-tutor/` | Course-scoped conversational tutor |
| Notification | `api/src/notification/` | In-app notifications + event listeners |
| Organization | `api/src/organization/` | Departments, designations |
| Employee | `api/src/employee/` | Employee directory + CSV import |
| Project | `api/src/project/` | Project + milestone tracking |
| Analytics | `api/src/analytics/` | Role-scoped dashboards, reports |
| Audit | `api/src/audit/` | Audit log capture + query |
| Storage | `api/src/storage/` | MinIO / S3 client abstraction |
| Health | `api/src/health/` | Liveness + readiness probes |

## Local Service Ports

| Service | Port | Notes |
|---------|------|-------|
| Web (Next.js) | 3001 | User-facing app |
| API (NestJS) | 3000 | REST + `/docs` Swagger |
| PostgreSQL | 5432 | Prisma target |
| Redis | 6379 | Cache / rate limiting (optional in dev) |
| Keycloak | 8080 | Realm `LMS` |
| MinIO API | 9000 | S3-compatible object storage |
| MinIO Console | 9001 | Admin UI |
