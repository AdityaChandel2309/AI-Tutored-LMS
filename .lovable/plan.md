
# Docs Polish Plan

Goal: make the repo read cleanly and completely when your senior opens it tomorrow. Documentation only — no code changes.

## Files to update

1. **Root `README.md`** — rewrite as the true entry point:
   - One-paragraph pitch (multi-tenant enterprise LMS for GAIL)
   - Tech stack table
   - Repo layout (`api/`, `web/`, `docs/`, `scripts/`, `docker-compose.yml`, `keycloak/`)
   - Quick start: `npm run bootstrap` → `docker-compose up` → `npm run dev` → service URLs (web 3001, api 3000, Keycloak, MinIO)
   - Default demo credentials (from seed scripts)
   - Links to `docs/ARCHITECTURE.md`, `docs/ADR.md`, `docs/RBAC_MATRIX.md`, `DEPLOYMENT_RUNBOOK.md`

2. **`docs/ARCHITECTURE.md`** — accuracy pass:
   - Verify tech-stack table matches `package.json` versions
   - Add modules missing from the list: `category`, `lesson-resource`, `document-embedding`, `knowledge-assistant`
   - Confirm ports/service names match `docker-compose.yml`

3. **`docs/RBAC_MATRIX.md`** — reflect recent changes:
   - Add `super_admin` column (course publish workflow)
   - Add rows for `submit-review`, `publish`, `archive`, `unpublish`
   - Note new backend guard: instructor PATCH only on `draft` or `archived`
   - Add `category` endpoints row

4. **`docs/ADR.md`** — two short ADRs in the existing format:
   - **ADR-008**: Course publish workflow with `super_admin` gate
   - **ADR-009**: Multi-select status + category filter UX for course list

5. **`docs/HARDENING_TASKS.md`** — append a "Pre-submission fixes" section marking backend edit gate and category chips ✅.

6. **`api/README.md` + `web/README.md`** — trim to a focused per-package quick start: install, dev, test, build, key env vars, pointer to root docs.

## Out of scope

- No code, config, migrations, or CI changes
- No screenshots
- No rewrites of ADR-001..007 or `docs/adr/001-*`, `002-*`
- No edits to `DEPLOYMENT_RUNBOOK.md` / `docs/DEPLOYMENT.md` beyond a link check
- `docs/archive/*` left untouched

## Deliverable

Seven files updated. After apply I'll list each file changed with a one-line summary so you can skim before the demo.
