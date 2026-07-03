
# Plan — Demo Content + UI/UX Polish

Two workstreams. Phase A seeds rich, per-role demo data so every feature shows real content on login. Phase B polishes the existing GAIL-blue UI across the three highest-traffic surfaces without changing the brand.

## Phase A — Rich per-role demo seed

New idempotent script: `api/src/scripts/seed-demo-full.ts` (registered as `npm run seed:demo` in `api/package.json`). Re-runnable; upserts by natural keys; deletes and rebuilds only per-user demo artifacts it owns (tagged with `demo:true` metadata where the schema allows).

Data it creates in the `default` tenant:

1. **Org structure** — 3 departments (Operations, Engineering, People & Culture), 6 designations, mapped to the 4 demo users.
2. **Categories** — Health & Safety, Professional Skills, Compliance, Technical, Leadership, Onboarding.
3. **Courses (7 published)** — extends the existing 2 demo courses with 5 more: Data Privacy & GDPR, Fire Safety Drill, Excel for Analysts, Leading Remote Teams, New Hire Onboarding. Each has 2–3 modules, 3–5 lessons (mix of `text`, `video` placeholder, `quiz`), realistic durations.
4. **Assessments** — every course gets a final quiz (5–8 questions, mixed types, 70% pass mark).
5. **Certificate templates** — one per course.
6. **Enrollments + progress + attempts + certificates (per-role)**:
   - **learner@lms.dev** — enrolled in 5 courses: 2 completed with issued certificates + passing attempts, 2 in-progress (30% / 65%), 1 not started.
   - **instructor@lms.dev** — owns 3 courses (appears as author), plus enrolled as learner in 1 completed course.
   - **manager@lms.dev** — enrolled in 2 courses (1 complete), plus is manager of a team of 4 synthetic reports with varied progress so team analytics populate.
   - **admin@lms.dev** — enrolled in 1, but primarily sees platform-wide analytics populated by the rest.
7. **Synthetic team members** — 6 extra users (no Keycloak, DB-only) reporting to manager for realistic team analytics/heatmaps.
8. **Notifications** — 4–6 per demo user (enrollment, cert issued, new course, quiz result, mention).
9. **Knowledge base** — 4 sample documents (Employee Handbook.pdf, Safety Policy.pdf, Onboarding Checklist.md, Code of Conduct.pdf) uploaded to MinIO with extracted text + embeddings so the AI Knowledge Assistant returns real citations.
10. **Projects** — 3 projects with milestones + members spanning departments, so the Projects module isn't empty.
11. **Audit log** — a handful of recent entries (login, course publish, cert issue) for the admin audit view.

Reset command: `npm run seed:demo -- --reset` wipes only demo-tagged rows before reseeding.

Docs: append a "Demo data" section to `LOCAL_SIGNIN.md` with the one-command run and what each demo login will see.

## Phase B — UI/UX polish (existing GAIL blue kept)

Scope: Learner dashboard + catalog + player, Instructor course builder + curriculum editor, Admin + analytics dashboards. No palette change, no font swap — tighten what's there.

Cross-cutting design tokens (`web/src/app/globals.css`):
- Consistent spacing scale (4 / 8 / 12 / 16 / 24 / 32 / 48), radii (`--radius-sm 6px`, `--radius 10px`, `--radius-lg 14px`), and elevation tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) used everywhere instead of ad-hoc values.
- Typography scale: display / h1 / h2 / h3 / body / small / caption with tuned line-heights; single H1 per page.
- Semantic status colors for `draft / review / published / archived` and `not_started / in_progress / completed / locked`, reused across badges, progress bars, and analytics.
- Standardized empty-state, loading-skeleton, and error components; replace the mixed spinner/`Notice` usage in dashboards.

Learner surfaces:
- Dashboard: hero "Continue learning" card (resumes last in-progress lesson), stat row (enrolled / completed / certificates / hours), "Recommended" and "Recently issued certificates" strips. Skeleton on load.
- Catalog: filter chips (category, duration, level), sortable grid of consistent course cards (cover, category, title, short desc, duration, module count, CTA), sticky search, empty state.
- Course player: two-pane layout — left curriculum tree with lesson state icons and per-module progress; right content region with clear breadcrumb, next/prev, mark-complete affordance, and a resources panel that renders the new `LessonResource` downloads inline.

Instructor surfaces:
- Course builder wizard: cleaner stepper header, sticky action bar (Save draft / Preview / Submit for review), improved module & lecture cards with drag handles and inline rename, unified upload states for video and downloadable resource, empty-module and empty-course guidance.
- Curriculum editor: consistent icons per lesson type, clearer publish/draft badges, contextual "Add lesson" menu.

Admin & analytics:
- Dashboard shell: refined sidebar (grouped nav, active state, collapsed mode), topbar with tenant name, search, notifications bell (unread count), user menu.
- Analytics: standardized KPI cards, one chart component wrapper (title / subtitle / legend / empty state), consistent Recharts theming using the semantic tokens, responsive tables with zebra rows and sticky headers.

Accessibility & responsiveness: focus rings on all interactive elements, `aria-label`s on icon buttons, keyboard nav in the course player tree, mobile breakpoints for dashboard/catalog/player.

## Order of execution

1. Write and run `seed-demo-full.ts` (unlocks realistic screenshots for the UI work).
2. Land shared tokens + primitives (`empty-state`, `stat-card`, `page-header`, `skeleton` variants, chart wrapper).
3. Polish learner surfaces (highest visibility).
4. Polish instructor builder.
5. Polish admin + analytics.
6. Update `LOCAL_SIGNIN.md` with demo seed instructions and per-role walkthrough.

## Technical notes

- Seed script uses Prisma directly, mirrors `seed-demo-courses.ts` conventions, and imports `loadProjectEnv()`.
- Knowledge doc seeding reuses `KnowledgeService.indexWithExtractedText` so citations work end-to-end.
- No schema migrations required — all new data fits existing models (`Enrollment`, `LessonProgress`, `AssessmentAttempt`, `IssuedCertificate`, `Notification`, `Project`, `Milestone`, `Document`, `AuditLog`).
- UI polish is pure frontend: `web/src/app/globals.css`, `web/src/components/ui/*`, and the specific page/component files under `web/src/app/dashboard/**` and `web/src/components/course-*`. No backend contract changes.
- Existing routes, API shapes, and auth flow untouched.
