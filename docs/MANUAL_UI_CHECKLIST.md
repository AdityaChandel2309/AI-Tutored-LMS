# Manual UI Validation Checklist

> Part of the **Real Usage Validation** phase. This checklist covers visual and UX validation
> that automated API workflow tests cannot catch (rendering bugs, navigation, role-based
> menu visibility, AI access boundaries).
>
> _Requirements: 9.1–9.4_

## How to Use This Checklist

1. **Seed the data first.** Run `npm run validate:seed` (from `api/`) so the database and
   Keycloak contain the baseline tenant, users, courses, documents, and projects this checklist
   assumes. Optionally run `npm run validate:deploy` to confirm the stack is healthy before you start.
2. **Open the web app** at `http://localhost:3001` (or the proxied URL via nginx on port 80).
3. **Work through one role at a time.** Log out fully between roles so Keycloak issues a fresh
   session with the correct realm roles.
4. **Check each box** (`- [ ]` → `- [x]`) only when the *Expected Outcome* is met exactly.
5. **Record every issue** in `docs/FRICTION_REPORT.md` under the appropriate severity, including a
   screenshot path or a description of the visual state (per Requirement 9.3). Use the **Notes**
   column in each table to jot the observation before transcribing it to the report.

### Seeded Users

All users live in the `default` tenant (subdomain `default`). Passwords are set by the seed script.

| Role           | Email                              | Password        | Primary purpose                                        |
|----------------|------------------------------------|-----------------|--------------------------------------------------------|
| admin          | `admin@lms-validation.local`       | `Admin123!`     | Full tenant administration, user management, audit     |
| instructor     | `instructor@lms-validation.local`  | `Instructor123!`| Course & knowledge authoring                           |
| learner        | `learner@lms-validation.local`     | `Learner123!`   | Enrollment, progress, AI Tutor, certificates           |
| employee-only  | `employee@lms-validation.local`    | `Employee123!`  | Profile, projects, Knowledge Assistant                 |

### Seeded Reference Data

| Entity                | Value                                                                 |
|-----------------------|-----------------------------------------------------------------------|
| Published course      | "Introduction to React" (status: published, has certificate template)|
| In-review course      | "Advanced Python for Data Science"                                    |
| Draft course          | "DevOps Fundamentals"                                                 |
| Knowledge documents   | "Employee Onboarding Guide" (PDF), "API Integration Reference" (DOCX) |
| Project               | "LMS Platform Enhancement" (3 milestones, 2 members)                  |
| Department hierarchy  | Engineering → Frontend Engineering                                    |

---

## 1. Login & Navigation (All Roles)

Repeat this section for **each** of the four seeded users.

| Flow | Preconditions | Steps | Expected Outcome | Notes |
|------|---------------|-------|------------------|-------|
| Keycloak login | Logged out; on landing page (`/`) | 1. Click **Login**. 2. Redirect to Keycloak. 3. Enter the role's email + password. 4. Submit. | Redirected back via `/callback` to `/dashboard`; no error banner; session established. | |
| Dashboard navigation | Logged in | 1. Land on `/dashboard`. 2. Observe header, sidebar, and main content. | Dashboard renders without console errors; user name/role visible; sidebar present. | |
| Sidebar role visibility | Logged in | 1. Inspect the sidebar sections and items. 2. Compare against the role-visibility table in Section 6. | Only the menu items permitted for the current role are shown; restricted items are hidden (not just disabled). | |
| Logout | Logged in | 1. Click **Logout**. 2. Confirm redirect. | Session cleared; returned to landing page; protected routes redirect to login when revisited. | |

---

## 2. Admin Role

Login as `admin@lms-validation.local`.

| Flow | Preconditions | Steps | Expected Outcome | Notes |
|------|---------------|-------|------------------|-------|
| Admin user management | Logged in as admin; on `/dashboard` | 1. Open the Admin panel / user management view. 2. View the seeded users list. 3. Inspect a user's roles. | All seeded users listed with correct roles; admin can view/manage roles; no 403. | |
| Dashboard summary cards | Logged in as admin | 1. View `/dashboard`. 2. Observe summary cards (only rendered for admin). | Summary cards render with counts; no broken widgets. | |
| Analytics | Logged in as admin | 1. Open **Analytics** (`/dashboard/analytics`). | Charts/summaries render with seeded analytics events; no empty-state crash. | |
| Activity timeline | Logged in as admin | 1. Open **Activity** (`/dashboard/activity`). | Activity events render in chronological order. | |
| Audit logs | Logged in as admin | 1. Open **Audit Logs** (`/dashboard/audit`). | Seeded audit entries listed with actor, action, entity, timestamp. | |
| Organization / departments | Logged in as admin | 1. Open **Organization** (`/dashboard/organization`). 2. View departments & designations. | Engineering → Frontend Engineering hierarchy visible; designations listed. | |
| Employees directory | Logged in as admin | 1. Open **Employees** (`/dashboard/employees`). 2. Open the seeded employee (EMP-001). | Employee profile shows department, designation, joining date. | |
| Course catalog browsing | Logged in as admin | 1. Open **Courses** (`/dashboard/courses`). | All courses visible (published, in-review, draft) with correct status badges. | |
| Knowledge base | Logged in as admin | 1. Open **Knowledge Base** (`/dashboard/knowledge`). 2. Open a document. | Both seeded documents listed; detail view shows metadata; download link works. | |
| Knowledge Assistant chat | Logged in as admin | 1. Open **AI Assistant** (`/dashboard/assistant`). 2. Ask: "What is in the onboarding guide?" | Response returns with source document references; graceful fallback if LLM unavailable. | |
| AI Tutor chat | Logged in as admin | 1. Open published course player. 2. Use the AI Tutor panel. 3. Send a question about the lesson. | Response returns and conversation persists; no enrollment block for admin. | |

---

## 3. Instructor Role

Login as `instructor@lms-validation.local`.

| Flow | Preconditions | Steps | Expected Outcome | Notes |
|------|---------------|-------|------------------|-------|
| Course catalog browsing | Logged in as instructor | 1. Open **Courses** (`/dashboard/courses`). | Courses listed; instructor can see authoring controls. | |
| Course creation | Logged in as instructor | 1. Click **New Course** (`/dashboard/courses/new`). 2. Enter title, description, category. 3. Save. | Course created with status **draft**; appears in listing. | |
| Course authoring (modules/lessons) | A draft course exists | 1. Open the course edit view (`/dashboard/courses/[id]/edit`). 2. Add a module and lessons. | Module/lesson hierarchy renders and saves correctly. | |
| Assessment authoring | A lesson exists | 1. Add an assessment with questions/options to a lesson. | Assessment is linked to the lesson and editable. | |
| Submit for review → publish | A draft course exists | 1. Submit course for review. 2. Publish. | Status transitions draft → in_review → published; reflected in UI badges. | |
| Knowledge upload | Logged in as instructor | 1. Open **Knowledge Base** → **Upload** (`/dashboard/knowledge/upload`). 2. Upload a document with a category. | Upload succeeds; document appears with metadata; download link works. | |
| Organization (view) | Logged in as instructor | 1. Open **Organization** / **Employees** (People section). | Instructor can view departments/employees but cannot create departments or import employees (controls hidden/denied). | |
| Knowledge Assistant chat | Logged in as instructor | 1. Open **AI Assistant** (`/dashboard/assistant`). 2. Ask a knowledge question. | Response returns with source references; instructor has access. | |
| Sidebar restrictions | Logged in as instructor | 1. Inspect sidebar. | No **Admin** section (Analytics/Activity/Audit Logs) visible; no user management. | |

---

## 4. Learner Role

Login as `learner@lms-validation.local`.

| Flow | Preconditions | Steps | Expected Outcome | Notes |
|------|---------------|-------|------------------|-------|
| Course catalog browsing | Logged in as learner | 1. Open **Courses** (`/dashboard/courses`). | Only published course "Introduction to React" is enrollable; draft/in-review not enrollable. | |
| Course enrollment | On the published course detail page | 1. Click **Enroll**. | Enrollment succeeds; progress shows 0%; course appears under **My Courses**. | |
| My Courses | Enrolled in a course | 1. Open **My Courses** (`/dashboard/my-courses`). | Enrolled course listed with progress bar at 0%. | |
| Course player lesson navigation | Enrolled in a course | 1. Open the course player. 2. Use Prev/Next and the player sidebar to move between lessons. | Lessons load; navigation works; active lesson highlighted; progress updates as lessons complete. | |
| Assessment submission | A lesson with an assessment | 1. Open the assessment / quiz player. 2. Answer all questions. 3. Submit. | Attempt is scored; pass/fail shown; correct answers yield a passing score. | |
| Certificate viewing | Completed the published course (has certificate template) | 1. Open **Certificates** (`/dashboard/certificates`). | Issued certificate appears with a unique certificate number; viewable/downloadable. | |
| AI Tutor chat (enrolled) | Enrolled in the published course | 1. In the course player, open the AI Tutor. 2. Ask a lesson question. | Response returns and conversation persists. | |
| AI Tutor chat (not enrolled) | Identify a course the learner is NOT enrolled in | 1. Attempt AI Tutor for that course. | Enrollment-required error/message shown; no response leaked. | |
| Sidebar restrictions | Logged in as learner | 1. Inspect sidebar. | No **People** (Employees/Organization) or **Admin** sections visible; sees Learning, Projects, Knowledge. | |

---

## 5. Employee-Only Role

Login as `employee@lms-validation.local`.

| Flow | Preconditions | Steps | Expected Outcome | Notes |
|------|---------------|-------|------------------|-------|
| Dashboard navigation | Logged in as employee-only | 1. Land on `/dashboard`. | Dashboard renders; no admin summary cards; no authoring controls. | |
| Own profile | Logged in as employee-only | 1. Open profile view. | Own profile details render. | |
| Projects | Logged in as employee-only | 1. Open **Projects** (`/dashboard/projects`). 2. Open "LMS Platform Enhancement". | Project visible with milestones in correct order and team members. | |
| Knowledge Assistant chat | Logged in as employee-only | 1. Open **AI Assistant** (`/dashboard/assistant`). 2. Ask a knowledge question. | Response returns with source references; access allowed. | |
| AI Tutor boundary | Logged in as employee-only | 1. Attempt to access an AI Tutor course chat. | No AI Tutor access (employee-only is not a learner enrolled in courses); blocked/hidden. | |
| Sidebar restrictions | Logged in as employee-only | 1. Inspect sidebar. | No **People** or **Admin** sections; no course authoring; sees profile/projects/Knowledge. | |
| Course authoring denied | Logged in as employee-only | 1. Attempt to reach `/dashboard/courses/new` directly. | Access denied / redirected; cannot create courses. | |

---

## 6. Sidebar Navigation Role Visibility

Verify the sidebar shows/hides items per role. Based on the sidebar configuration
(`web/src/components/portal/sidebar-nav.tsx`): the **People** section is visible to `admin` and
`instructor`; the **Admin** section is visible to `admin` only; all other sections are visible to
every authenticated role. Use ✅ = should be **visible**, ❌ = should be **hidden**.

| Section | Menu Item | Route | admin | instructor | learner | employee-only |
|---------|-----------|-------|:-----:|:----------:|:-------:|:-------------:|
| (Home) | Home | `/dashboard` | ✅ | ✅ | ✅ | ✅ |
| Learning | Courses | `/dashboard/courses` | ✅ | ✅ | ✅ | ✅ |
| Learning | My Courses | `/dashboard/my-courses` | ✅ | ✅ | ✅ | ✅ |
| Learning | Certificates | `/dashboard/certificates` | ✅ | ✅ | ✅ | ✅ |
| People | Employees | `/dashboard/employees` | ✅ | ✅ | ❌ | ❌ |
| People | Organization | `/dashboard/organization` | ✅ | ✅ | ❌ | ❌ |
| Projects | Projects | `/dashboard/projects` | ✅ | ✅ | ✅ | ✅ |
| Knowledge | Knowledge Base | `/dashboard/knowledge` | ✅ | ✅ | ✅ | ✅ |
| Knowledge | AI Assistant (Knowledge Assistant) | `/dashboard/assistant` | ✅ | ✅ | ✅ | ✅ |
| Admin | Analytics | `/dashboard/analytics` | ✅ | ❌ | ❌ | ❌ |
| Admin | Activity | `/dashboard/activity` | ✅ | ❌ | ❌ | ❌ |
| Admin | Audit Logs | `/dashboard/audit` | ✅ | ❌ | ❌ | ❌ |

Per-role verification:

- [ ] **admin** — all sections/items above are visible.
- [ ] **instructor** — People + Learning + Projects + Knowledge visible; Admin section hidden.
- [ ] **learner** — Learning + Projects + Knowledge visible; People and Admin sections hidden.
- [ ] **employee-only** — Learning + Projects + Knowledge visible; People and Admin sections hidden.

> Note: The **AI Tutor** is contextual (it lives inside the course player for enrolled courses),
> not a standalone sidebar item. The sidebar **AI Assistant** entry routes to the Knowledge
> Assistant. If observed sidebar visibility differs from this table, record it as a bug in
> `docs/FRICTION_REPORT.md`.

---

## 7. AI Access Boundary Verification

Verify each role gets the correct AI feature access. ✅ = should have access, ❌ = should be denied.

| Role | AI Tutor (course chat) | Knowledge Assistant | Boundary Notes |
|------|:----------------------:|:-------------------:|----------------|
| admin | ✅ (all courses) | ✅ | Full access to both AI features. |
| instructor | ✅ (authored/owned courses) | ✅ | Knowledge Assistant access; AI Tutor in instructor's course context. |
| learner | ✅ (enrolled courses only) | ✅ | AI Tutor blocked for non-enrolled courses (enrollment-required error). |
| employee-only | ❌ | ✅ | Knowledge Assistant only; not a course learner, so no AI Tutor. |

Per-role verification:

- [ ] **admin** — AI Tutor responds for any course; Knowledge Assistant responds with sources.
- [ ] **instructor** — Knowledge Assistant responds; AI Tutor available in course context.
- [ ] **learner** — AI Tutor responds for the enrolled published course; AI Tutor for a
      non-enrolled course returns an enrollment-required error; Knowledge Assistant responds.
- [ ] **employee-only** — Knowledge Assistant responds; AI Tutor is not accessible.

> AI degradation check: If the LLM backend is unreachable, every AI feature above must return a
> graceful fallback message (not an unhandled 500). Record any unhandled error as a bug.

---

## 8. Recording Observations

For any flow that fails or behaves unexpectedly:

1. Note the role, flow name, and what you observed in the **Notes** column above.
2. Add an entry to `docs/FRICTION_REPORT.md`:
   - **Bugs** → severity (critical / major / minor), reproduction steps, expected vs actual.
   - **UX friction points** → description + suggested improvement.
3. Attach a **screenshot path** or a written description of the visual state (Requirement 9.3),
   e.g. `docs/screenshots/learner-enroll-error.png` or "Enroll button overlaps the price badge
   on mobile width 375px".
