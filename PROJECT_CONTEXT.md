# Project Context

Use this file to bootstrap a fresh Codex session for this repository.

## Project

- Path: `/home/adityachandel/projects/LMS`
- Product: Enterprise LMS platform
- Target roadmap source: `LMS_Implementation_Plan.pdf`
- Current execution stage: `Phase 2A`

## How To Interpret Sources

- `LMS_Implementation_Plan.pdf` is the target architecture and phased roadmap.
- Prior chat history reflects what was attempted during implementation.
- The current codebase is the source of truth for what actually exists.
- `PHASE1_CHECKLIST.md` is the stable Phase 1 baseline and handoff history.
- `.claude-flow/hive-mind/state.json` stores repo-local Ruflo project memory.

## Read These First

1. `PHASE1_CHECKLIST.md`
2. `.claude-flow/hive-mind/state.json`
3. `api/src/app.controller.ts`
4. `api/src/auth/`
5. `api/src/tenant/`
6. `api/src/user/`
7. `api/prisma/schema.prisma`
8. `web/src/app/callback/page.tsx`
9. `web/src/app/dashboard/page.tsx`
10. `docker-compose.yml`

## Current Baseline

### Task pass — June 2026 (catalog cleanup, course-flow bug fixes, automatic lesson completion)

- **Catalog cleanup.** The author catalog hid leftover acceptance-test
  artifacts (empty draft courses titled "SCORM Course" with zero modules) so
  they no longer clutter `web/src/app/dashboard/courses/page.tsx`.
- **Edit "something went wrong" fixed.** Root cause: the editor read
  `course._count.enrollments`, but backend `getCourse` (unlike
  `getCourses`/`create`/`update`) didn't include `_count`, throwing a render
  `TypeError` caught by the ErrorBoundary. `getCourse`
  (`api/src/course/course.service.ts`) now includes `_count`, and the edit page
  reads it defensively (`c._count?.enrollments ?? 0`).
- **Enrollment 409 now friendly.** Cross-cutting fix in
  `web/src/lib/api/client.ts`: error parsing read `body.message`, but the
  backend envelope is `{ error: { message } }`, so every error degraded to
  "HTTP 409". The client now reads `error.message` (and handles
  validation-array messages), which improves error text app-wide. The catalog
  detects `ApiError.status === 409`, shows an inline "already enrolled" banner
  and routes to My Courses, and renders a "Go to Course" button (instead of
  "Enroll Now") for already-enrolled courses to avoid the conflict entirely.
- **Create-course page hardened.** `courses/new/page.tsx` now uses the shared
  `useCreateCourse`/`useCategories` hooks with title/description length
  validation, character counters, Enter-to-submit, category loading/error
  states, and real error messages. Depends on the edit-page fix so the
  post-create redirect into the editor no longer crashes.
- **Automatic lesson completion (Udemy/Coursera style).** Removed the manual
  "Start Lesson"/"Mark Complete" buttons for auto-trackable lesson types:
  - Text lessons: new `components/course-player/text-lesson-reader.tsx` uses
    `IntersectionObserver` on a bottom sentinel plus a 5s dwell timer; fires once.
  - Video lessons: `video-player.tsx` listens to `timeupdate` and completes once
    at 90% watched (and on `ended`).
  - Quiz lessons: auto-complete on pass (unchanged). Other types (scorm,
    assignment) keep a manual "Mark Complete" so learners are never blocked.
  Backend: new xAPI-style endpoint `POST /courses/complete-lesson`
  (`progress.controller.ts` + `completeLesson` in `progress.service.ts` +
  `dto/complete-lesson.dto.ts`) accepts `{ courseId, lessonId, status,
  timestamp, userId }`, ignores client `userId` (session is authoritative),
  and reuses the idempotent `upsertProgress`. Wired through a BFF route
  (`web/src/app/api/courses/complete-lesson/route.ts`) and `useCompleteLesson`;
  the player invalidates the progress query for instant UI feedback (sidebar
  dot turns green, "✓ Lesson completed", auto-advance).
- **Verification.** Backend builds clean; `progress.service.spec.ts` now 15/15
  (added 3 `completeLesson` tests) and `course.service.spec.ts` 7/7 green; web
  lint clean and `tsc` clean except two pre-existing Playwright e2e type errors.
  Playwright acceptance specs not run (require the full live stack).

### Task pass — June 2026 (catalog trim, course-flow fixes, AI tutor in player, role model)

- **Catalog now shows exactly 2 working demo courses.** New idempotent seed
  `api/src/scripts/seed-demo-courses.ts` (`npm run seed:demo-courses`) creates two
  fully-built PUBLISHED courses ("Workplace Safety Essentials", "Effective
  Communication at Work") with ordered modules/lessons and real text content,
  and demotes any other published course in the default tenant to `draft`
  (reversible). The learner catalog also filters to published-only.
- **Instructors can author from the website.** Fixed the broken create flow
  (frontend never sent the backend-required `slug`); slugs are now auto-generated
  in both the create page and `useCreateCourse`. Authoring controls (Create
  Course, per-card Edit) are gated to admin/instructor in the catalog.
- **Course flow fixed (was broken).** Two root causes:
  1. `Lesson` had no `order` column but the player/sidebar sorted by `order`,
     so lesson sequence was non-deterministic. Added `Lesson.order` (+ migration
     `20260603000000_add_lesson_order`, unique `(moduleId, order)`),
     auto-assignment on create, and reorder support on update.
  2. Progress API contract mismatch: the player read `summary.{total,completed,progress}`
     and `lessons[].lessonId`, but the backend returned
     `summary.{totalLessons,completedLessons,progressPercent}` and `lessons[].lesson.id`.
     `getProgress` now returns BOTH shapes (frontend-facing + backward-compatible).
     Also `enrollment.progress` is now stored as a 0–1 fraction to match the UI.
- **AI tutor wired into the course player.** New `components/ai/course-tutor-panel.tsx`
  floating panel calls the existing enrollment-guarded `/ai-tutor` endpoint with
  course + active-lesson context; shown only to enrolled learners. Text lessons
  now render readable prose instead of raw JSON.
- **Role model implemented per spec.** New `api/src/auth/roles.ts`
  `deriveEffectiveRoles`: everyone is `employee`; `admin`/`instructor` are also
  `learner`; admin+instructor overlap; `super_admin` implies `admin`. Applied in
  `jwt.strategy.ts`. Admin panel now assigns multiple roles and previews the
  effective set. Backend tests: 22 suites / 191 tests green; web build clean.



The repo now represents a full **Enterprise Workforce Intelligence & Knowledge Platform** with the LMS as a core subsystem. The platform has expanded from a dedicated LMS into an enterprise portal with 6 new backend modules and a unified frontend shell.

Implemented (in addition to all prior LMS work):

- Enterprise Organization module (`api/src/organization/`) — departments with hierarchy, designations with seniority levels, full CRUD, tenant-scoped
- Enterprise Employee module (`api/src/employee/`) — employee profiles linked to Users, paginated directory with search/filters, reportees endpoint, CSV bulk import
- Enterprise Project Tracking module (`api/src/project/`) — projects with validated status workflow, milestones with ordering, team member management
- Enterprise Knowledge module (`api/src/knowledge/`) — document library with S3 file upload, version management, presigned download URLs, document categories, text search (ILIKE + tags), PDF + Office doc support
- LMS AI Tutor module (`api/src/ai-tutor/`) — course-contextual chat, enrollment guard, LLM API integration (OpenAI-compatible), conversation persistence
- Enterprise Knowledge Assistant module (`api/src/knowledge-assistant/`) — enterprise Q&A over published documents, keyword retrieval, LLM integration, source citations
- Enterprise Portal Shell (`web/src/components/portal/`) — unified sidebar navigation with role-based visibility (Home, Learning, People, Projects, Knowledge, Admin), collapsible layout
- Dashboard layout (`web/src/app/dashboard/layout.tsx`) — wraps all dashboard pages with portal shell
- Frontend pages for all new domains: `/dashboard/organization`, `/dashboard/employees`, `/dashboard/projects`, `/dashboard/knowledge`, `/dashboard/assistant`
- BFF proxy routes for all new backend endpoints
- Typed API clients and TypeScript interfaces for all new domains
- 4 Prisma migrations applied: organization/employee models, project tracking models, knowledge/document models, AI models
- Prisma schema now has 22+ models covering all enterprise domains

New backend modules registered in `app.module.ts`:
- OrganizationModule, EmployeeModule, ProjectModule, KnowledgeModule, AiTutorModule, KnowledgeAssistantModule

Recently fixed:

- Authenticated request context now includes `tenantId` from the LMS database in `api/src/auth/jwt.strategy.ts`
- Next.js route protection now exists in `web/src/proxy.ts`
- Callback flow now mirrors tokens into cookies so frontend route protection can read auth state
- API tenant resolution now exists through middleware with `x-tenant-id`, `x-tenant-subdomain`, and subdomain lookup support, without silent default fallback
- Tenant-scoped admin user reads and updates now enforce the current resolved tenant
- Prisma schema validity was fixed by restoring `DATABASE_URL` in `schema.prisma` and aligning Prisma package versions to `6.19.3`
- Tenant ownership is now non-null in Prisma, with a migration to backfill legacy users and tenant subdomains
- Dashboard requests now send `x-tenant-subdomain: default` in local development, and tenant resolution tests now cover the stricter rules
- Admin user create, role update, and deactivate routes now sync to Keycloak and persist `isActive` state locally
- Backend verification coverage now exists for `/me`, tenant resolution, RBAC decisions, and admin user service flows
- `api/PHASE1_VERIFICATION.md` now records the current API contract baseline and verification commands
- `web/src/components/admin-panel.tsx` now provides a working admin UI for list/create/update/deactivate user flows
- The local Prisma target database at `localhost:5432/lms` is now migrated and confirmed up to date
- Frontend auth/session handling now goes through Next.js API routes that set and read `HttpOnly` auth cookies for callback, logout, `/me`, and admin user requests
- Backend auth now exposes a refresh-token path, and the Next.js proxy layer retries once with refreshed cookies on `401`
- `api/test/live-auth.acceptance.ts` now provides live Keycloak-backed acceptance coverage for `/me` and `/users`
- Users can now update profile names and upload avatars to MinIO through the dashboard and authenticated API routes
- Dashboard refresh failures now redirect to `/?reason=session-expired`, and the login page shows a specific expired-session notice
- `web/e2e/dashboard.acceptance.spec.ts` now provides frontend browser acceptance coverage for dashboard, profile, avatar, admin flows, and forced re-login behavior
- API runtime env loading now reads both `api/.env` and the repo root `.env`, which fixes MinIO and Keycloak admin credential drift when the API boots from `api/`
- API auth, JWT issuer/JWKS config, CORS origins, host/port binding, and public URL logging are now env-driven through `api/src/config/runtime.ts`
- Repo-owned env templates now exist in `.env.example`, `api/.env.example`, and `web/.env.local.example`
- Repo-owned Keycloak realm/client provisioning now exists in `keycloak/realm-config.json` and is applied via `npm run provision:keycloak`
- `docker-compose.yml` now includes `api`, `web`, and `keycloak-provisioner`, and the full local stack reached healthy container state with Postgres, MinIO, Keycloak, API, and web up
- Swagger/OpenAPI baseline now exists at `/docs` and `/docs-json`, with controller and DTO annotations covering auth, app, and user flows
- The web UI baseline now includes shared `Badge` and `Field` primitives and a repo-owned design-system note in `web/DESIGN_SYSTEM_BASELINE.md`
- The web app now persists a tenant preference cookie on login, infers tenant from hostname where possible, and only falls back to the default tenant for true local-host development
- The Nest app now standardizes success responses as `{ data, meta }` and errors as `{ error }`, while the Next.js proxy routes unwrap successful backend payloads before they reach the React UI
- Storage/runtime config now centralizes MinIO settings through runtime helpers, prefers explicit access/secret keys, and only uses localhost-style storage fallbacks in local development
- Repo-owned rollout guidance now exists in `DEPLOYMENT_RUNBOOK.md`, and `api` now exposes `npm run verify:runtime -- <local|shared|production>` for deployment preflight checks
- Swagger `/docs` plus `/docs-json` are now explicit in the API bootstrap, and the web app has been moved from `middleware.ts` to `proxy.ts` to match the newer Next.js convention
- Phase 2A has now started in the backend with tenant-scoped course-domain models in Prisma plus a `course` module covering course CRUD, enrollment, `GET /my-courses`, Swagger decorators, tests, and the applied migration `20260524085343_add_course_domain_foundation`
- Tenant-scoped category management now also exists in the backend through a dedicated `category` module with CRUD APIs, Swagger decorators, and service-level test coverage
- Tenant-scoped module authoring now exists through a dedicated `module` NestJS module (`api/src/module/`) with `POST /courses/:id/modules`, `PATCH /modules/:id`, `DELETE /modules/:id`, auto-order assignment, order conflict detection, cascading tenant validation through the parent course, and service-level test coverage
- Tenant-scoped lesson authoring now exists through a dedicated `lesson` NestJS module (`api/src/lesson/`) with `POST /modules/:id/lessons`, `PATCH /lessons/:id`, `DELETE /lessons/:id`, cascading tenant validation through module→course, Prisma-safe nullable JSON content handling, and service-level test coverage
- The `Progress` model has been enhanced per enterprise LMS recommendations: `enrollmentId` is now required (replaces direct `userId`), lesson-level progress is tracked with `state` (not_started/in_progress/completed/locked), fractional `progress` (0-1), and automatic `startedAt`/`completedAt`/`lastViewedAt` timestamp management. Course-level completion is derived from lesson completion and cached on `Enrollment.progress`. Migration `20260524120111_enhance_progress_model` has been applied.
- Tenant-scoped progress tracking now exists through a dedicated `progress` NestJS module (`api/src/progress/`) with `POST /courses/:courseId/progress` (upsert lesson progress), `GET /courses/:courseId/progress` (per-lesson breakdown with aggregate summary), `PATCH /progress/:id` (direct update), state validation, enrollment recomputation, and service-level test coverage
- A course publish workflow now enforces explicit lifecycle transitions via `POST /courses/:id/submit-review`, `POST /courses/:id/publish`, `POST /courses/:id/archive`, and `POST /courses/:id/unpublish`. Status is modeled as a const enum (`draft`, `review`, `published`, `archived`) with a validated transition map. Status is validated on course creation and enrollment is guarded to published courses only.
- A domain events foundation (`api/src/events/`) provides typed event interfaces (`CoursePublished`, `EnrollmentCreated`, `LessonCompleted`, `CourseCompleted`, etc.) and an `EventBus` service wrapping `@nestjs/event-emitter`. The `EventsModule` is globally registered. Course workflow transitions emit domain events for future notification/certificate/analytics consumers.
- Video pipeline MVP now exists: `Video` model + migration, presigned upload/stream endpoints, Next.js proxy routes, a course editor upload control, and course player video playback.
- SCORM metadata pipeline now exists: `ScormPackage` model + migration, upload/confirm/launch/file streaming endpoints, Next.js proxy routes, course editor SCORM upload control, SCORM player integration, and Playwright acceptance coverage.

## Phase Status

Phase 1 is effectively complete as a stable platform baseline.
Phase 2 is ~90-95% complete. Phase 3 is ~50-60% complete.
Phase 4 (Enterprise Platform Expansion) is 100% complete — all 14 tasks delivered.

Done or mostly done:

- Keycloak integration
- Backend JWT validation
- Basic RBAC route protection
- User auto-provisioning on `/me`
- Default tenant assignment
- Basic dashboard shell
- Initial Phase 2A course-domain backend foundation
- Category management backend foundation
- Module authoring backend (create, update, delete with tenant scoping)
- Lesson authoring backend (create, update, delete with tenant scoping)
- Progress tracking backend (lesson-level upsert, derived course completion, state machine)
- Course publish workflow (draft → review → published → archived with explicit transition APIs)
- Domain events foundation (EventBus + typed event interfaces)
- Enrollment guard (published courses only)
- Course catalog page (search/filter, enroll button, create course button, edit links)
- My Courses page (enrolled courses with progress bars, completion badges)
- Stabilized course player (next/prev navigation, auto-mark-in-progress, auto-advance on complete, localStorage resume, URL hash deep-linking)
- Course creation page (title, description, category selector → redirects to editor)
- Instructor course editor (metadata editing, module/lesson CRUD, publish workflow controls)
- Dashboard navigation cards (Browse Courses, My Courses quick-access)
- TanStack Query integration (QueryClient provider, mutation cache invalidation, 30s stale time)
- Typed API client (`lib/api/client.ts`) with centralized error handling
- Typed TanStack Query hooks (`lib/api/courses.ts`) — query key factory pattern
- Shared domain types (`lib/types/course.ts`) — single source of truth
- Extracted component boundaries (`components/course-player/`, `components/progress/`)
- 14 Next.js API proxy routes for course domain
- Stabilization pass: resolved TypeScript/lint issues across API/web tests, auth guards, and runtime config checks
- **Enterprise Organization Module** — departments (hierarchical), designations, full CRUD with tenant isolation
- **Enterprise Employee Module** — employee profiles, paginated directory with search/filters, reportees, CSV bulk import
- **Enterprise Project Tracking Module** — projects with status workflow (planning→active→on_hold→completed→cancelled), milestones, team members
- **Enterprise Knowledge Module** — document library with S3 upload, versioning, presigned downloads, categories, text search, PDF + Office doc support
- **Enterprise Portal Shell** — unified sidebar navigation with role-based visibility, collapsible layout wrapping all dashboard pages
- **LMS AI Tutor** — course-contextual chat with enrollment guard, LLM integration (OpenAI-compatible), conversation persistence
- **Enterprise Knowledge Assistant** — enterprise Q&A over published documents with keyword retrieval, LLM integration, source citations
- **AI Chat Frontend** — reusable chat panel component, enterprise assistant page, BFF proxy routes

Still missing or incomplete:

- Video pipeline advanced features (HLS/DASH adaptive bitrate streaming, transcoding queue)
- Enterprise integrations (SAP ERP, Active Directory — future)

Recently completed:

- Video pipeline enhancements: ffmpeg-based thumbnail extraction, ffprobe duration detection, `thumbnailKey` on Video model, `GET /videos/:id/thumbnail` endpoint, fire-and-forget async processing on upload confirm, graceful degradation when ffmpeg is unavailable
- SCORM runtime: `ScormRuntimeData` Prisma model, `GET /scorm/:id/runtime-data` and `PUT /scorm/:id/runtime-data` endpoints, vanilla JS SCORM API (`window.API` for SCORM 1.2 + `window.API_1484_11` for SCORM 2004), upgraded ScormPlayer component with runtime injection and completion tracking, BFF proxy route
- Turborepo monorepo orchestration: `turbo.json` config, npm workspaces for `api/` and `web/`, unified `build`/`dev`/`test`/`lint`/`clean` scripts at root

## Current Priority Order

1. Enterprise platform stabilization (test all new modules end-to-end)
2. Video pipeline advanced (HLS/DASH adaptive bitrate, transcoding queue)
3. Enterprise integrations (SAP, AD — future)

## Known Important Caveats

- Runtime config is now largely env-driven, storage defaults are local-only, and explicit MinIO credentials are supported, but shared/staging/production environments still need reviewed values and rollout steps.
- Shared/staging/production rollout now has a repo-owned runbook and a runtime preflight command, but real deployment still depends on reviewed environment-specific values and operator execution.
- Compose now includes app containers and provisioning, but on this machine `podman-compose` still needed direct `podman start` fallback after build/recreate to move created containers forward.
- Admin and profile UI now work through Next.js proxy routes, refresh failure now returns users to login with an explicit expired-session notice, and frontend browser acceptance covers those core paths.
- Tenant support now prefers a persisted tenant cookie or hostname inference, and only falls back to the default tenant in local-host development when neither is present.
- Current automated verification now covers backend behavior, live auth acceptance, real frontend browser flows, and a healthy Compose-backed local stack.
- The old process still bound to `localhost:3000` may need a restart to pick up the explicit Swagger JSON route, but a fresh build served both `/docs` and `/docs-json` with `200` on a clean process.
- Prisma migrations were applied only to the local `lms` database in this turn, not to any shared or production environment.
- Avatar storage now supports explicit MinIO access/secret keys and local-only fallbacks, but shared environments should still set storage values explicitly.

## Resume Prompt

Use this prompt in a fresh session:

```text
Project: /home/adityachandel/projects/LMS

Read these first:
- PROJECT_CONTEXT.md
- .claude-flow/hive-mind/state.json
- docs/IMPLEMENTATION_PLAN.md
- docs/TASK_BREAKDOWN.md
- docs/WALKTHROUGH.md

The platform is now an Enterprise Workforce Intelligence & Knowledge Platform.
The LMS is one subsystem inside a larger enterprise portal.
All 14 expansion tasks are complete (Organization, Employee, Project, Knowledge, AI Tutor, Knowledge Assistant, Portal Shell).

The current codebase is the source of truth.
Continue from the current baseline — inspect the repo before changing code.
```
