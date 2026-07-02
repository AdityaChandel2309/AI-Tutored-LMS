# Implementation Plan — Enterprise Hardening & Operational Maturity

## Problem Statement

The platform is now functionally complete across 7 domains (LMS, Organization, Employee, Project, Knowledge, AI Tutor, Knowledge Assistant). The next priority is NOT feature expansion — it is converting this into a stable, maintainable, enterprise-operational platform. The bottleneck is reliability, maintainability, and operational maturity.

## Requirements

1. Production-grade observability without distributed tracing complexity
2. Immutable audit logging for enterprise governance
3. Practical security hardening (rate limiting, upload validation, prompt safety)
4. AI reliability improvements (anti-hallucination, token budgeting, source enforcement)
5. Performance optimization (N+1 fixes, indexes, pagination consistency)
6. CI/CD pipeline for automated quality gates
7. Portal UX polish (loading states, empty states, responsive improvements)
8. Documentation maturity (architecture docs, RBAC matrix, runbooks)

## Constraints

- NO microservices, Kubernetes, distributed event streaming
- NO OpenTelemetry, Grafana/Prometheus stacks
- NO enterprise IAM complexity, zero-trust networking
- NO autonomous AI agents, LangGraph, memory frameworks
- NO Redis-heavy architectures, queue systems
- Keep: single VM + Docker Compose + nginx deployment model

## Current State Assessment

**Already exists:**
- Health endpoint with DB + S3 checks (GET /health, GET /health/ready)
- Exception filter with structured error responses
- Response envelope interceptor
- Security headers in nginx (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy)
- Domain events via EventBus + EventEmitter2
- AnalyticsEvent model for event persistence
- Basic GitHub Actions workflow (copilot-setup-steps only)

**Missing:**
- Structured logging with correlation IDs
- Audit logging (separate from analytics)
- Rate limiting
- Upload size/MIME hardening beyond knowledge module
- AI prompt safety / token budgeting
- DB indexes for new models
- CI/CD pipeline (lint/test/build/playwright)
- Loading/empty states in frontend
- Architecture documentation

---

## Phase Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1–4 | Observability & Monitoring |
| 2 | 5–7 | Audit Logging & Governance |
| 3 | 8–11b | Security Hardening + Feature Flags |
| 4 | 12–14 | AI Hardening |
| 5 | 15–17 | Performance & Scalability |
| 6 | 18–20 | CI/CD & Deployment |
| 7 | 21–23 | Portal UX Maturity |
| 8 | 24–26 | Documentation |

---

## Phase 1: Observability & Monitoring (4 tasks)

### Task 1: Structured Logging with Correlation IDs

**Objective:** Replace default NestJS logger with structured JSON logging and request correlation IDs.

**Implementation:**
- Create `api/src/common/logger/` with custom NestJS LoggerService outputting structured JSON (timestamp, level, message, correlationId, tenantId, userId, module)
- Create `CorrelationIdMiddleware` — reads `X-Request-Id` header or generates UUID, attaches to request, injects into AsyncLocalStorage
- Update `ApiExceptionFilter` to include correlationId in error responses
- Update `main.ts` to use the custom logger

**Test:** Logger outputs valid JSON; correlation ID propagates through request lifecycle.

---

### Task 2: Request Logging Middleware

**Objective:** Log every HTTP request/response with timing, status, and tenant context.

**Implementation:**
- Create `RequestLoggerMiddleware` — logs on response finish
- Include: method, path, status code, response time (ms), correlationId, tenantId, user agent
- Skip logging for `/health` endpoints
- Register globally in `AppModule`

**Test:** Requests produce structured log entries with timing.

---

### Task 3: Error Logging Enhancement

**Objective:** Ensure all unhandled errors and 5xx responses are logged with full context.

**Implementation:**
- Update `ApiExceptionFilter` to log 5xx at `error` level with stack trace + correlationId + tenantId + path
- Log 4xx at `warn` level without stack trace
- Suppress stack traces for expected 4xx (NotFound, Forbidden, etc.)

**Test:** 500 errors produce error-level log with stack; 404s produce warn-level without stack.

---

### Task 4: Frontend Error Boundary & Retry UX

**Objective:** Add global error boundary and network retry feedback to the frontend.

**Implementation:**
- Create `components/ui/error-boundary.tsx` — catches React render errors, shows friendly message + retry button
- Create `components/ui/network-error.tsx` — shown when API calls fail, with retry action
- Wrap dashboard layout with error boundary
- Add retry logic to TanStack Query config (1 retry with exponential backoff for network errors)

**Test:** Frontend does not crash on component errors; shows retry UI on network failure.

---

## Phase 2: Audit Logging & Governance (3 tasks)

### Task 5: Audit Log Model & Service

**Objective:** Create an immutable audit log system separate from analytics events.

**Implementation:**
- Add `AuditLog` Prisma model: id, tenantId, actorId, action (string), entityType, entityId, metadata (Json), ipAddress, userAgent, createdAt
- Create `api/src/audit/` module with `AuditService`
- `AuditService.log()` method — append-only, no update/delete operations
- Create `AuditInterceptor` that auto-logs write operations (POST/PATCH/DELETE) with actor, entity, and action
- Track: employee updates, project changes, document uploads/deletes, role changes, certificate issuance, AI interactions
- Migration for AuditLog table
- **Future consideration:** Add `tokenEstimate` and `latencyMs` fields to `AiTutorMessage` and `KnowledgeAssistantMessage` models now (lightweight prep for future AI monitoring — token usage analytics, hallucination review, prompt tracing, model usage metrics). A dedicated `AIInteractionLog` model can be introduced later when AI volume justifies it.

**Test:** Write operations produce audit log entries; entries are immutable (no update endpoint).

---

### Task 6: Audit Log Query Endpoints

**Objective:** Admin-only endpoints to query audit logs with filters and pagination.

**Implementation:**
- `GET /audit-logs` — paginated, filterable by actorId, entityType, action, date range
- Admin-only access (`@Roles('admin')`)
- Include actor name resolution (join to User)
- Sort by createdAt desc

**Test:** Admin can query logs; non-admin gets 403.

---

### Task 7: Frontend Audit Viewer

**Objective:** Admin page to browse audit logs.

**Implementation:**
- Page: `/dashboard/admin/audit` — table with filters (actor, entity type, date range)
- Pagination
- Add to sidebar under Admin section
- BFF proxy route

**Test:** Page renders with audit entries; filters work.

---

## Phase 3: Security Hardening (4 tasks)

### Task 8: Rate Limiting

**Objective:** Protect API from abuse with request throttling.

**Implementation:**
- Install `@nestjs/throttler`
- Configure global throttle: 100 requests/minute per IP
- Stricter limits for auth endpoints: 10 requests/minute
- Stricter limits for AI endpoints: 20 requests/minute
- Return 429 with Retry-After header

**Test:** Exceeding rate limit returns 429.

---

### Task 9: Upload Validation Hardening

**Objective:** Enforce consistent file size limits and MIME validation across all upload endpoints.

**Implementation:**
- Create shared `FileValidationPipe` — validates size + MIME type
- Enforce limits: documents (50MB), videos (1GB), SCORM (500MB), avatars (5MB), CSV (10MB)
- Validate MIME by reading file magic bytes (not just extension/content-type header)
- Apply to all upload endpoints (knowledge, video, scorm, avatar, employee import)

**Test:** Oversized files rejected; wrong MIME types rejected.

---

### Task 10: AI Prompt Safety

**Objective:** Sanitize user inputs to AI endpoints to prevent prompt injection. String stripping alone is insufficient — use defense in depth.

**Implementation:**
- Create `sanitizePromptInput()` utility — strips common injection patterns ("ignore previous instructions", "system:", role-switching attempts)
- Apply to AI Tutor `chat` and Knowledge Assistant `ask` inputs
- Log sanitization events at warn level
- Add max input length enforcement (2000 chars for tutor, 1000 for assistant)
- **System prompt reinforcement:** Re-assert AI role constraints at the END of the context (after user messages) to resist injection
- **Retrieval-only constraints:** Knowledge Assistant must only use provided document context, never generate from parametric knowledge
- **Answer refusal patterns:** If confidence is low or no documents match, refuse to answer rather than hallucinate

**Test:** Injection attempts are stripped; oversized inputs rejected; system prompt reinforcement present in all LLM calls.

---

### Task 11: RBAC & Tenant Isolation Review

**Objective:** Verify all new modules enforce correct RBAC and tenant isolation.

**Implementation:**
- Audit all controller endpoints for correct guard decorators
- Verify all service methods check `tenantId` before data access
- Add missing guards where found
- Document RBAC matrix in `docs/RBAC_MATRIX.md`
- Add nginx CSP header: `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';`

**Test:** Unauthenticated requests return 401; wrong-role requests return 403.

---

### Task 11b: Environment-Driven Feature Flags

**Objective:** Add simple feature flags to safely enable/disable modules without code changes.

**Implementation:**
- Create `api/src/config/feature-flags.ts` — reads env vars, exports typed flags:
  - `ENABLE_AI_TUTOR` (default: true)
  - `ENABLE_KNOWLEDGE_ASSISTANT` (default: true)
  - `ENABLE_PROJECT_MODULE` (default: true)
  - `ENABLE_KNOWLEDGE_MODULE` (default: true)
  - `ENABLE_EMPLOYEE_MODULE` (default: true)
- Create `FeatureFlagGuard` — returns 404 if the module's flag is disabled
- Apply guard to AI Tutor, Knowledge Assistant, Project, Knowledge, and Employee controllers
- Add `GET /features` endpoint (public) — returns which features are enabled (for frontend sidebar visibility)
- Frontend sidebar reads `/features` to show/hide sections dynamically
- Document all flags in `.env.production.template`

**Test:** Disabling a flag returns 404 for that module's endpoints; sidebar hides the section.

**Why:** Critical for safe AI rollout, staged enterprise deployments, and future per-tenant feature control.

---

## Phase 4: AI Hardening (3 tasks)

### Task 12: Improved Prompt Architecture

**Objective:** Make AI responses more reliable and source-grounded.

**Implementation:**
- Knowledge Assistant: enforce "Only answer based on provided documents. If no relevant document exists, say so explicitly."
- AI Tutor: enforce "Only explain concepts from this course. Redirect off-topic questions."
- Add response format instructions: "Be concise. Use bullet points. Cite document titles."

**Test:** Off-topic questions get appropriate redirects; answers cite sources.

---

### Task 13: Token Budget & Context Trimming

**Objective:** Prevent context overflow and control LLM costs.

**Implementation:**
- Add `trimContext()` utility — truncates conversation history to fit within ~3000 token budget
- Limit document context to 2000 chars per document, max 5 documents
- Limit lesson content context to 2000 chars
- Add `max_tokens` response limit: 512 for tutor, 768 for assistant
- Log token usage estimates

**Test:** Long conversations do not exceed context limits; responses stay within budget.

---

### Task 14: Graceful AI Fallbacks

**Objective:** Handle LLM failures gracefully without exposing errors to users.

**Implementation:**
- On LLM timeout (>30s): return friendly timeout message
- On LLM error: return temporary unavailability message
- On empty/invalid response: return rephrase suggestion
- Add circuit breaker: after 3 consecutive failures, skip LLM for 60s and return fallback immediately
- Log all failures at error level with correlation ID

**Test:** LLM failures produce user-friendly messages; circuit breaker activates after repeated failures.

---

## Phase 5: Performance & Scalability (3 tasks)

### Task 15: Database Indexes

**Objective:** Add missing indexes for query performance on new models.

**Implementation:**
- `EmployeeProfile`: `@@index([tenantId, departmentId])`, `@@index([tenantId, designationId])`
- `Project`: `@@index([tenantId, departmentId])`, `@@index([tenantId, ownerId])`
- `Milestone`: `@@index([projectId, status])`
- `Document`: `@@index([tenantId, categoryId])`, `@@index([tenantId, uploadedById])`
- `AuditLog`: `@@index([tenantId, createdAt])`, `@@index([tenantId, actorId])`, `@@index([tenantId, entityType])`
- Run migration

**Test:** Migration applies; explain plans show index usage.

---

### Task 16: N+1 Query Fixes & Pagination Consistency

**Objective:** Ensure all list endpoints use efficient queries and consistent pagination.

**Implementation:**
- Review all `findMany` calls — ensure `include` is used instead of separate queries
- Standardize pagination response: `{ items, total, page, limit }` across all list endpoints
- Add pagination to `getDepartments` and `getProjects`
- Ensure all list endpoints have defaults (page=1, limit=20, max=100)

**Test:** List endpoints return consistent pagination metadata.

---

### Task 17: Dashboard Aggregation Optimization

**Objective:** Optimize dashboard summary queries to avoid full table scans.

**Implementation:**
- Create `api/src/dashboard/` module with `DashboardService`
- Endpoint: `GET /dashboard/summary` — counts for active projects, employees, published documents, recent activity
- Use `count()` queries (not `findMany().length`)
- Cache results for 30s using simple in-memory TTL cache (no Redis)

**Test:** Dashboard summary returns in <100ms; cache works.

---

## Phase 6: CI/CD & Deployment (3 tasks)

### Task 18: GitHub Actions CI Pipeline

**Objective:** Automated quality gates on every push/PR.

**Implementation:**
- Create `.github/workflows/ci.yml`
- Trigger: push to main, pull_request
- Jobs: lint, test, build (parallel for api and web)
- API: `npm run lint`, `npm test`, `npm run build`
- Web: `npm run lint`, `npm run build`
- Services: PostgreSQL (for Prisma migrate + tests)
- Cache: node_modules via actions/cache
- Fail fast on any step failure

**Test:** Push triggers CI; failures block merge.

---

### Task 19: Docker Build & Deployment Validation

**Objective:** Automated Docker image builds and deployment validation.

**Implementation:**
- Add Docker build step to CI (build api + web images, verify they start)
- Create `scripts/validate-deployment.sh` — checks all services respond to health endpoints
- Update `DEPLOYMENT_RUNBOOK.md` with rollback procedure
- Add `scripts/backup-db.sh` — pg_dump wrapper for database backup

**Test:** Docker images build in CI; validation script passes.

---

### Task 20: Environment Validation

**Objective:** Prevent deployment with missing/invalid configuration.

**Implementation:**
- Update `verify-runtime-config.ts` to check LLM_API_URL, LLM_API_KEY, LLM_MODEL
- Add startup validation in `main.ts` — warn (not crash) if AI env vars are missing
- Create `.env.production.template` with all required vars documented

**Test:** Missing critical env vars produce clear error messages at startup.

---

## Phase 7: Portal UX Maturity (3 tasks)

### Task 21: Loading & Empty States

**Objective:** Add consistent loading and empty states across all pages.

**Implementation:**
- Create `components/ui/loading-spinner.tsx` — centered spinner with optional message
- Create `components/ui/empty-state.tsx` — icon + message + optional action button
- Add loading states to: employees, projects, knowledge, organization pages
- Add empty states with contextual messages

**Test:** Pages show spinner while loading; empty state when no data.

---

### Task 22: Responsive Sidebar & Mobile UX

**Objective:** Make portal usable on tablets and mobile.

**Implementation:**
- Sidebar: auto-collapse on screens < 1024px
- Add hamburger menu button on mobile
- Overlay sidebar on mobile (click outside to close)
- Ensure data grids stack vertically on mobile

**Test:** Sidebar collapses on resize; pages usable on mobile widths.

---

### Task 23: Dashboard Summary Cards

**Objective:** Make the home dashboard show cross-module summaries.

**Implementation:**
- Update `/dashboard/page.tsx` to fetch from `GET /dashboard/summary`
- Show cards: Active Projects, Employees, Published Documents, Recent Activity
- Role-based: learners see learning stats only; admins see all
- Quick-action links in each card

**Test:** Dashboard shows real counts; role-based visibility works.

---

## Phase 8: Documentation (3 tasks)

### Task 24: Architecture Documentation

**Objective:** Create comprehensive architecture docs.

**Implementation:**
- Create `docs/ARCHITECTURE.md` — system overview, module diagram, data flow, deployment topology
- Create `docs/AI_ARCHITECTURE.md` — AI Tutor + Knowledge Assistant design, prompt strategy, RAG roadmap
- Create `docs/TENANT_ISOLATION.md` — how multi-tenancy works across all modules
- Include Mermaid diagrams

---

### Task 25: RBAC Matrix & Module Ownership

**Objective:** Document who can do what across the platform.

**Implementation:**
- Create `docs/RBAC_MATRIX.md` — table of all endpoints x roles
- Create `docs/MODULE_OWNERSHIP.md` — module dependencies, key files
- Create `docs/AUDIT_LOGGING.md` — what is logged, retention, query patterns

---

### Task 26: Updated Project Context & ADRs

**Objective:** Keep project memory current.

**Implementation:**
- Update `PROJECT_CONTEXT.md` with hardening phase completion
- Update `.claude-flow/hive-mind/state.json`
- Create `docs/adr/003-enterprise-hardening-decisions.md`
- Update `docs/TASK_BREAKDOWN.md`

---

## Success Criteria

After completion:
- All API requests produce structured JSON logs with correlation IDs
- All write operations produce immutable audit log entries
- Rate limiting protects against abuse
- AI responses are source-grounded and gracefully handle failures
- No N+1 queries in list endpoints
- CI pipeline catches regressions automatically
- All pages have loading/empty states
- Architecture is fully documented
- `npm run lint`, `npm test`, `npm run build` pass for both api and web
