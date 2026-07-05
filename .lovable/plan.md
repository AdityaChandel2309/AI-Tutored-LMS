## Scope

Fix seven issues across the API, web dashboard, and Docker seeding. Below is what will change and why. Technical details are in the last section.

---

### 1. Course status filter — multi-select

**Problem:** The Published / Draft / Review chips on the catalog page act like radio buttons — clicking one deselects the others.

**Change:** Make them true multi-select toggles. User can enable any combination (e.g. Published + Draft) and the grid shows the union.

- Backend `GET /courses?status=` will accept a comma-separated list (`?status=published,draft`) instead of a single value; visibility rules apply per-status.
- Frontend chip bar becomes a `Set<status>` with toggle-on-click; empty set means "all visible-to-me".

### 2. Only super-admin can publish; super-admin gets notified; deep-link from notification

**Problem:** Admin role can also publish, and no one gets pinged when an instructor submits for review.

**Changes:**

- Keep `POST /courses/:id/publish` restricted to `super_admin` (already correct in controller — will also enforce in service).
- Hide the "Publish" action button in the UI unless the current user has `super_admin`.
- Add a notification listener on the existing `course.submitted_for_review` event that creates a notification for every super-admin in the tenant. Title: *"Course pending review:* &nbsp;*"*, with metadata `{ courseId, action: 'review' }`.
- Notification row becomes clickable — when `metadata.courseId` is present, it links to `/dashboard/courses/:id/edit` (author view) for super-admin so they can review + publish. Existing enrollment/certificate notifications also become clickable to their course.
- Similarly notify the course author when their course is `published` or sent back to `draft` (unpublished).

### 3 & 4. Visibility rules

**Rules to enforce (server-side, RBAC-scoped):**


| Status    | Learner | Instructor (not author) | Instructor (author) | Admin | Super-admin |
| --------- | ------- | ----------------------- | ------------------- | ----- | ----------- |
| Published | see     | see                     | see                 | see   | see         |
| Review    | —       | —                       | see (own only)      | —     | see (all)   |
| Draft     | —       | —                       | see (own only)      | —     | —           |
| Archived  | —       | —                       | see (own only)      | see   | see         |


- Course create restricted to `instructor` role only (admins/super-admins can no longer create). "Create Course" button in UI hidden for non-instructors.
- The single-status filter branch and the "no status" branch in `CourseService.getCourses` are rewritten around this matrix, applied per requested status when the client sends multiple.
- `getCourse(:id)` also gets a visibility guard so nobody can bypass by direct URL.
- Chip bar visibility: Learners see only "Published". Instructors see Published + Draft + Review. Admins see Published. Super-admins see Published + Review.

### 5. Dashboard bugs — profile update + create user

Will investigate both flows end-to-end (network + server logs) and fix:

- **Identity Settings → Update profile**: check `PATCH /me` (or equivalent) request/response, DTO validation, and the form's submit handler. Likely a field-name mismatch or a missing tenant scope.
- **Create user on dashboard**: check `POST /users` request; likely a required-field (roles/tenant/keycloakId) validation error or a Keycloak provisioning failure. Will surface the real error to the UI and fix the underlying cause.

I'll also sweep the dashboard for other broken calls (network 4xx/5xx on load) and fix what shows up.

### 6. Audit Logs page

Investigate `/dashboard/audit` — most likely a query/pagination or column-mismatch bug against `GET /audit`. Fix once the exact failure is captured from the browser network panel and server logs.

### 7. Seed data survives `docker compose down` + rebuild

**Problem:** Seed data is wiped whenever the DB container is recreated.

**Root cause:** Postgres data lives in the named volume `postgres_data`, so `docker compose down` alone preserves it — but `docker compose down -v` or a volume prune (which the user may be doing) removes it, and any fresh clone starts empty.

**Change — auto-seed on first boot, idempotent:**

- Add an `api` startup step: on container start, run `prisma migrate deploy` (already happens) and then a new `npm run seed:auto` that:
  - Checks a `SeedMarker` row (or counts tenants) — if the demo tenant already exists, exits early. Otherwise runs `seed-demo-full` end-to-end.
- Add an env flag `AUTO_SEED_DEMO=true` (default `true` in `docker-compose.override.yml`, `false` in production example) so it never runs unintentionally in prod.
- Result: `docker compose down && docker compose up` (with or without `-v`) → demo data is present on first request, and re-runs are no-ops.

---

## Technical details

**Backend (`api/src/course/course.service.ts`)**

- Accept `status?: string` where value may be `"published,draft,review"`; split → `string[]`.
- Build one `OR` array per requested status using the matrix above; final `where = { tenantId, OR: [...] }`.
- Add `getCourse` visibility guard: after fetching, throw `NotFoundException` (not Forbidden — avoids info leak) if the caller can't see this status.
- `createCourse`: throw `ForbiddenException` unless roles include `instructor`.

**Backend (`api/src/course/course.controller.ts`)**

- Pass `roles` + `userId` through to `getCourse` too.
- `@Roles('instructor')` on `POST /courses`.

**Backend (`api/src/notification/notification.listener.ts`)**

- New `@OnEvent('course.submitted_for_review')`: query all users in tenant with `super_admin` role, create one notification per super-admin with `metadata.courseId` and `metadata.action='review'`.
- New `@OnEvent('course.published')` / `@OnEvent('course.unpublished')`: notify course author.

**Frontend (`web/src/app/dashboard/courses/page.tsx`)**

- Replace `statusFilter: string` with `Set<string>`; chips toggle membership.
- Chip list computed from role.
- API hook `useCourses` updated to send `status=a,b,c`.
- `Create Course` button hidden unless `instructor`.

**Frontend (`web/src/app/dashboard/notifications/page.tsx`)**

- Wrap each row: if `metadata.courseId` present, link to `/dashboard/courses/:id/edit` for authors/super-admin (review action) else `/dashboard/courses/:id` for learners. Mark as read on click.

**Dashboard bugs (5, 6)** — will patch after reproducing with dev-server logs + network inspection; scope limited to the failing endpoints and their form/table wiring.

**Seeding (7)**

- New script `api/src/scripts/auto-seed.ts` — imports the existing `seedDemoFull`, guards with a `select count from tenant where slug='demo'`.
- `api/Dockerfile` CMD (or `docker-compose.yml` api command) becomes: `sh -c "prisma migrate deploy && (AUTO_SEED_DEMO=true && node dist/src/scripts/auto-seed.js || true) && node dist/src/main.js"`.
- `.env.example` documents `AUTO_SEED_DEMO`.

---

## Out of scope(try these also)

- No changes to auth provider, Prisma schema shape, or theming.
- No new migrations unless required by a discovered dashboard bug.