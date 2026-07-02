# Plan — sequential delivery of three focus areas

## 0. Prerequisite fix: root `build:dev` script (blocking)

The async build failed with `Script not found "build:dev"`. Root `package.json` only has `build`, `dev`, `test`, `lint`, `clean`. Add a `build:dev` script so the harness can build the monorepo.

- Add `"build:dev": "turbo run build"` (or `turbo run build --filter=web` if we only need the frontend to build in the sandbox).
- No other repo changes needed for this.

Do this first as a one-line change, then proceed to work stream 1.

---

## 1. RAG upgrade for Knowledge Assistant (first)

Goal: replace the keyword-only retrieval in `api/src/knowledge-assistant/` with vector retrieval powered by the existing `api/src/document-embedding/` module, and surface citations in the frontend.

Backend
- Audit `document-embedding.service.ts` for: embedding provider (env-configurable), chunking strategy, storage location (Postgres `pgvector` vs JSON), and whether embeddings are generated on document upload.
- If not already wired, hook `document.uploaded` / `document.published` events → embed + persist chunks (tenant-scoped).
- Add a backfill script `api/src/scripts/backfill-document-embeddings.ts` for existing docs.
- In `knowledge-assistant.service.ts`:
  - Replace keyword search with `embedQuery → topK chunk retrieval` (tenant-scoped, respects document `status`/RBAC).
  - Build context from retrieved chunks with source metadata (documentId, title, versionNumber, page/section if available).
  - Keep the LLM call via `LlmClient` (existing) with a system prompt that requires inline citations.
  - Return `{ answer, sources: [{ documentId, title, snippet, score }] }`.
- Add unit tests: retrieval ranking, tenant isolation, empty-corpus fallback, citation shape.

Frontend
- `web/src/lib/api/ai.ts`: extend types for `sources[]`.
- `components/ai/knowledge-chat.tsx`: render source chips linking to `/dashboard/knowledge/[id]`; show "no matching documents" state.
- `/dashboard/assistant` page: unchanged shell, uses new chat component output.

Verification
- Unit tests green; manual: upload PDF → ask a question referencing it → citations appear and link works.

---

## 2. Assessments + Certificates UI (second)

Goal: build learner + instructor frontends on top of existing `api/src/assessment/` and `api/src/certificate/` backends.

Discovery step (kept short)
- Read `assessment.controller.ts`, `assessment.service.ts`, DTOs (`create-assessment`, `create-question`, `submit-attempt`), and `certificate.controller.ts` / `create-template` / `issue-certificate` to lock the exact API contract.

Backend touch-ups (only if needed)
- Ensure endpoints exist for: list attempts by user, get certificate PDF/download URL, issue-on-course-completion event listener (if not already emitting).
- Add missing BFF-friendly response shapes only where the UI needs them.

Frontend — Learner
- `lib/types/assessment.ts`, `lib/types/certificate.ts`, `lib/api/assessments.ts` (extend), `lib/api/certificates.ts` (extend).
- BFF proxy routes for any missing endpoints under `web/src/app/api/assessments/*` and `.../certificates/*`.
- Course player: quiz lesson type already auto-completes on pass — add a proper attempt UI (`components/assessment/attempt-runner.tsx`) with question navigation, timer (uses `durationSec`), submit, and result view.
- `/dashboard/my-courses/[id]/certificate` — view/download issued certificate.
- Dashboard: "My Certificates" section on `/dashboard`.

Frontend — Instructor
- Inside course editor (`/dashboard/courses/[id]/edit`): "Assessments" tab
  - List/create/update assessments per lesson or course.
  - Question authoring UI (MCQ, true/false, short answer — whatever DTOs support), version bump on edit.
- `/dashboard/certificates/templates` — CRUD for certificate templates (name, background asset, fields).

Verification
- New Jest specs for hooks; Playwright acceptance: learner takes a quiz, passes, gets certificate.

---

## 3. Analytics dashboards frontend (third)

Goal: expand `/dashboard` and role-specific analytics pages on top of `api/src/analytics/` and existing xAPI events.

Discovery
- Read `analytics.controller.ts`, `analytics.service.ts`, `analytics.listener.ts`, `dto/activity-query.dto.ts`, `dto/report-query.dto.ts`, and existing `dashboard-summary` route.

Frontend
- `lib/types/analytics.ts` (extend), `lib/api/analytics.ts` (extend with typed hooks).
- New pages:
  - `/dashboard/analytics` (admin) — cross-module KPIs: active learners, course completions, avg score, top courses, recent activity feed.
  - `/dashboard/analytics/courses/[id]` (instructor) — enrollment funnel, per-lesson completion, avg attempt score, drop-off.
  - `/dashboard/analytics/me` (learner) — hours learned, courses completed, certificates, streak.
- Reusable chart components in `components/analytics/` using a lightweight library (recharts) — install via `bun add recharts` in `web/`.
- Portal shell: add "Analytics" nav item with role-gated visibility.
- Empty/loading states via existing patterns.

Backend touch-ups (only if needed)
- Fill any missing aggregation endpoints the pages require (list gaps first, batch into one PR).

Verification
- Jest for any new service methods; Playwright: admin sees analytics page with charts populated from seeded data.

---

## Execution flow

1. Land the `build:dev` script fix.
2. Ship RAG upgrade end-to-end, then pause for review.
3. Ship Assessments + Certificates UI, then pause for review.
4. Ship Analytics dashboards.

Each work stream ends with tests, a build, and updates to `PROJECT_CONTEXT.md` + relevant `docs/*` files per repo conventions.

## Technical notes

- All new backend code stays tenant-scoped via `TenantAwareRequest` and uses the `EventBus` for cross-module signals (embeddings, certificate issuance).
- All new frontend data reads go through TanStack Query hooks in `lib/api/*` and BFF proxy routes — no direct backend calls from components.
- Follow existing DTO + Swagger conventions; add `@ApiProperty` on every new DTO field.
- Response envelope (`{ data, meta }` / `{ error }`) is preserved via `ResponseEnvelopeInterceptor` — do not bypass.
- No changes to auth, tenant middleware, or Prisma migrations unless a specific step calls it out; embeddings likely need a new migration (pgvector or JSON column) — flagged in step 1.
