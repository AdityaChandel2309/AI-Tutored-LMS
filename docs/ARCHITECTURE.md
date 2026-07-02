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
| AI | OpenAI-compatible LLM API |
| Containerization | Docker, Docker Compose |
| CI | GitHub Actions |

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
