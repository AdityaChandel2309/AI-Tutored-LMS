# Implementation Plan — Enterprise Workforce Intelligence & Knowledge Platform

## Problem Statement

The current LMS is a mature, well-architected learning platform. The business requirement from GAIL leadership is to expand it into a full **Enterprise Workforce Intelligence & Knowledge Platform** — where the LMS becomes one subsystem inside a larger enterprise portal that also includes Employee Management, Project Tracking, Enterprise Knowledge, and AI Assistants.

## Requirements

1. **Preserve existing LMS** — no rewrites, expand around it
2. **Add Employee/Organization domain** — departments, designations, hierarchy, employee profiles, directory (manual entry + CSV import)
3. **Add Project Tracking domain** — projects, milestones, status dashboards, department mapping
4. **Add Enterprise Knowledge domain** — SOPs, policies, manuals as PDF + Office docs, searchable library
5. **Add AI systems** (two distinct):
   - LMS AI Tutor (inside LMS module)
   - Enterprise Knowledge Assistant (separate, RAG-based later)
6. **Timeline:** ~4 days under guided implementation
7. **Architecture constraints:** Keep modular monolith, single Docker Compose, Prisma, tenant isolation, event-driven analytics

## Background (Current Architecture)

- **Backend:** NestJS modular monolith, 18 domain modules, Prisma + PostgreSQL, EventEmitter2 event bus, JWT/RBAC guards, tenant middleware, Swagger
- **Frontend:** Next.js App Router, `/dashboard/*` pages, `/api/*` BFF proxy routes, TanStack Query, Tailwind CSS, domain-organized components
- **Infrastructure:** Docker Compose + nginx, Keycloak auth, S3-compatible storage
- **Patterns:** Controller → Service → Prisma, DTOs with Swagger decorators, `TenantAwareRequest`, `ResponseEnvelopeInterceptor`, `ApiExceptionFilter`, `EventBus.emit()`

## Key Conventions

| Concern | Pattern |
|---------|---------|
| Auth | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` |
| Multi-tenancy | `req.tenant?.id` from `TenantAwareRequest` |
| DTOs | Class with `@ApiProperty()` decorators |
| Events | `EventBus.emit({ type, tenantId, timestamp, actorId, entityId, entityType, payload })` |
| API responses | Wrapped by `ResponseEnvelopeInterceptor` |
| Frontend API | `lib/api/{domain}.ts` using `apiGet/apiPost/apiPatch/apiDelete` |
| Frontend types | `lib/types/{domain}.ts` |
| BFF routes | `app/api/{resource}/route.ts` proxying to NestJS |
| Pages | `app/dashboard/{section}/page.tsx` |

## Architecture Diagram (Final State)

```
Enterprise Portal
├── LMS Module (existing)
│   ├── Courses, SCORM/video learning
│   ├── Assessments, Certificates
│   ├── AI Tutor
│   └── Learning analytics
│
├── Employee Management Module
│   ├── Employee profiles
│   ├── Department hierarchy
│   ├── Reporting managers
│   └── Employee search/directory
│
├── Project Tracking Module
│   ├── Projects, Milestones
│   ├── Status dashboards
│   └── Department mapping
│
├── Enterprise Knowledge Module
│   ├── SOPs, Manuals, Policies
│   ├── Document versioning
│   └── Searchable knowledge base
│
└── Enterprise AI Assistant
    ├── Policy Q&A
    ├── Document search
    └── Enterprise knowledge chat
```

## Phase Summary

| Phase | Day | Focus | Tasks |
|-------|-----|-------|-------|
| 1 | Day 1 | Employee & Organization Domain | Tasks 1–4 |
| 2 | Day 2 | Project Tracking Domain | Tasks 5–7 |
| 3 | Day 3 | Enterprise Knowledge Domain | Tasks 8–10 |
| 4 | Day 4 | Portal Shell + AI Foundation | Tasks 11–14 |
