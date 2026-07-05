# Pre-Submission Smoke Test Plan

Goal: Walk every critical flow end-to-end before tomorrow's demo, catch any last regressions, and hand you a pass/fail report with fixes for anything broken.

## What I'll test (in order)

### 1. Auth & Tenant
- Keycloak login → redirect → dashboard loads
- Logout clears session
- Tenant resolution via subdomain works

### 2. Identity Settings (recently touched)
- Save profile succeeds without error toast
- Create user (admin) succeeds and appears in list
- Role assignment persists after reload

### 3. Course List — Filters (recently touched)
- Status multi-select chips filter correctly (single + multi)
- Category multi-select chips filter correctly (single + multi)
- Combined status + category filter works
- Chips stay visible when result set is empty
- Empty state message renders when no matches

### 4. Course Edit Access Rules (recently touched)
- Instructor sees Edit only on `draft` and `archived` courses in list
- Instructor opening a `published` or `review` course URL directly sees the warning notice, not the editor
- Admin/super_admin still edit all statuses

### 5. Course Builder Wizard
- Landing phase points 1–4 render + save correctly
- Module / lesson / resource CRUD
- Publish workflow: draft → submit-review → publish → archive → unpublish

### 6. Other modules (quick sanity)
- Employee list + create
- Project list + milestone add
- Knowledge doc upload + view
- AI Tutor responds
- Audit log viewer loads recent entries

### 7. Infra sanity
- `docker-compose up` cleanly (no missing env)
- API `/health` returns ok
- Web dev build compiles with no TS errors
- CI workflow passes on last commit

## Deliverable

A single report grouped by module:
- ✅ Pass items (one-liners)
- ❌ Fail items with: what I did, what I expected, what happened, proposed fix
- ⚠️ Minor polish suggestions (optional, safe to skip)

For any ❌, I'll wait for your go-ahead before switching to build mode to fix — so you decide what's worth touching the night before submission.

## Out of scope (unless you ask)

- New features
- Refactors
- Doc rewrites
- Deployment tuning
