# Handoff To Antigravity

Use this file as the first repo-local handoff source for the next model.

## Current State

- Phase 1 is effectively complete as a stable platform baseline.
- Phase 2 is ~90-95% complete (backend + full learner/instructor frontend).
- The backend covers: course authoring with publish workflow, category, module, lesson, progress tracking, and domain events.
- The frontend covers: course catalog, my-courses, stabilized course player (next/prev/resume/auto-progress), instructor editor with publish workflow, and dashboard navigation.
- Frontend architecture is now mature: typed API client, centralized TanStack Query hooks, extracted component boundaries.

## Read In This Order

1. `HANDOFF_TO_ANTIGRAVITY.md`
2. `PROJECT_CONTEXT.md`
3. `PHASE1_CHECKLIST.md`
4. `.claude-flow/hive-mind/state.json`
5. `api/prisma/schema.prisma`
6. `api/src/course/` (includes `course-status.ts`, `course-workflow.service.ts`)
7. `api/src/events/` (domain events foundation)
8. `api/src/category/`
9. `api/src/module/`
10. `api/src/lesson/`
11. `api/src/progress/`
12. `api/PHASE1_VERIFICATION.md`

## What Is Already Done

- Keycloak auth, JWT validation, tenant resolution, RBAC, admin user CRUD, cookie-backed sessions, refresh recovery, profile/avatar upload, rollout runbook, runtime preflight tooling, Swagger, and browser/live acceptance are in place.
- `proxy.ts` replaced the old `middleware.ts` convention on the web app.
- Swagger `/docs` and `/docs-json` are explicit in backend bootstrap.
- The local Phase 2A migrations have been applied:
  - `api/prisma/migrations/20260524085343_add_course_domain_foundation`
  - `api/prisma/migrations/20260524120111_enhance_progress_model`

## Phase 2A Backend Implemented

### Prisma Models

- `Category`
- `Course`
- `CourseModule`
- `Lesson`
- `Enrollment`
- `Progress`

### APIs Implemented

- `GET /courses`
- `POST /courses`
- `GET /courses/:id`
- `PATCH /courses/:id`
- `DELETE /courses/:id`
- `POST /courses/:id/enroll`
- `GET /my-courses`
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `DELETE /categories/:id`
- `POST /courses/:id/modules`
- `PATCH /modules/:id`
- `DELETE /modules/:id`
- `POST /modules/:id/lessons`
- `PATCH /lessons/:id`
- `DELETE /lessons/:id`
- `POST /courses/:courseId/progress`
- `GET /courses/:courseId/progress`
- `PATCH /progress/:id`
- `POST /courses/:id/submit-review`
- `POST /courses/:id/publish`
- `POST /courses/:id/archive`
- `POST /courses/:id/unpublish`

### Frontend Pages Implemented

- `/dashboard` — updated with course navigation cards (Browse Courses, My Courses)
- `/dashboard/courses` — course catalog with search/filter, enrollment button, create course button, edit links
- `/dashboard/my-courses` — enrolled courses with progress bars, completion badges
- `/dashboard/courses/[id]` — stabilized course player: next/prev navigation, auto-mark-in-progress, auto-advance on complete, localStorage resume, URL hash deep-linking
- `/dashboard/courses/new` — course creation form (title, description, category)
- `/dashboard/courses/[id]/edit` — instructor course editor (metadata editing, module/lesson CRUD, publish workflow controls)

### Frontend Architecture (Refactored)

- **Typed API client** (`lib/api/client.ts`) — centralized `apiFetch`/`apiGet`/`apiPost`/`apiPatch`/`apiDelete` with typed `ApiError`
- **Typed hooks** (`lib/api/courses.ts`) — centralized TanStack Query hooks: `useCourse`, `useCourseProgress`, `useUpdateProgress`, `useEnroll`, `useCourseWorkflow`, `useAddModule`, `useDeleteLesson`, etc.
- **Shared types** (`lib/types/course.ts`) — single source of truth for `Course`, `Enrollment`, `ProgressSummary`, `Lesson`, etc.
- **Extracted components**:
  - `components/course-player/player-sidebar.tsx` — module/lesson tree with state dots
  - `components/course-player/lesson-content.tsx` — lesson content area with nav + progress controls
  - `components/progress/progress-bar.tsx` — reusable progress bar
- TanStack Query (`@tanstack/react-query`) via `Providers` wrapper, 30s stale time, query key factory

### Frontend API Proxy Routes

- `GET/POST /api/courses`
- `GET/PATCH/DELETE /api/courses/[id]`
- `POST /api/courses/[id]/enroll`
- `POST /api/courses/[id]/modules`
- `POST /api/courses/[id]/submit-review`
- `POST /api/courses/[id]/publish`
- `POST /api/courses/[id]/archive`
- `POST /api/courses/[id]/unpublish`
- `GET/POST /api/courses/[id]/progress`
- `PATCH/DELETE /api/modules/[id]`
- `POST /api/modules/[id]/lessons`
- `PATCH/DELETE /api/lessons/[id]`
- `GET /api/my-courses`
- `GET/POST /api/categories`

## Verified Before Handoff

From `api/`:

```bash
npx prisma generate
npx prisma migrate deploy
npm test
npm run build
```

Status at handoff:

- `13` API test suites passing
- `80` tests passing
- Frontend build succeeds cleanly

## Exact Next Step

Phase 2 is essentially complete. Next:

1. ~~module authoring~~ ✅
2. ~~lesson authoring~~ ✅
3. ~~progress skeleton APIs~~ ✅
4. ~~course publish workflow~~ ✅
5. ~~domain events foundation~~ ✅
6. ~~Phase 2A frontend: course catalog, my-courses, course player, dashboard nav~~ ✅
7. ~~Instructor authoring UI (create course, edit metadata, add module/lesson, delete module/lesson)~~ ✅
8. ~~Course publish lifecycle UI (submit-review, publish, archive, unpublish buttons)~~ ✅
9. Course player stabilization (lesson navigation, completion semantics, auto-progress, resume state)
10. Video pipeline (after player UX stabilizes)

## Rules To Preserve

- Keep every domain query tenant-scoped.
- Do not start SCORM yet.
- Do not start frontend course UI before backend authoring APIs stabilize.
- Keep Prisma schema, migration, database, tests, and docs synchronized continuously.
- Update these files after meaningful progress:
  - `PROJECT_CONTEXT.md`
  - `PHASE1_CHECKLIST.md`
  - `.claude-flow/hive-mind/state.json`
  - `api/PHASE1_VERIFICATION.md` when verification expectations materially change

## Known Caveats

- On this machine, `podman-compose` may leave containers in `Created`; direct `podman start` was previously needed.
- The long-running old API process on `localhost:3000` may need restart to pick up the newest Swagger route changes, although a fresh process already served `/docs` and `/docs-json` correctly.
- Shared/staging/production rollout still requires real reviewed environment values and operator execution.

## Anti-Regression Note

Do not waste time re-auditing Phase 1 from scratch.

The safest continuation path is:

1. trust the repo-local handoff files
2. inspect `api/src/course/`, `api/src/events/`, `api/src/category/`, `api/src/module/`, `api/src/lesson/`, and `api/src/progress/`
3. start Phase 2A frontend surfaces next
4. verify with tests and build before expanding further
