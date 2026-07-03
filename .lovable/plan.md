# What's Left — Prioritized Backlog

Based on the current state (RAG upgrade, lesson resources, demo seed, and auth/login polish all done), here's what's still valuable to build. Grouped by impact.

## 1. Phase B — UI/UX polish (already approved, not yet executed)
The demo seed landed but the visual polish pass never happened. This is the highest-leverage next step because the rich demo data now makes the rough edges obvious.

- Shared design tokens in `web/src/app/globals.css` (spacing scale, radii, elevation, status colors).
- Shared primitives: `EmptyState`, `StatCard`, `PageHeader`, skeleton variants, `ChartCard` wrapper.
- Learner surfaces: dashboard "Continue learning" hero, catalog filter chips + consistent cards, two-pane course player with resources panel.
- Instructor: cleaner wizard stepper, sticky action bar, unified upload states.
- Admin/analytics: refined sidebar/topbar, standardized KPI cards, one chart wrapper, responsive tables.
- A11y + mobile breakpoints across the three surfaces.

## 2. Feature gaps still visible in the app

- **Assessments runner + authoring UI polish** — backend is solid, but learner-side quiz taking (timer, question navigation, review, results) and instructor question bank editing are thin. Wire to the new demo assessments.
- **Certificate viewer + share** — issued certs exist in DB after the seed, but there's no polished view/download/verify-by-code page for learners; no printable template preview for authors.
- **Notifications tray** — `Notification` rows are seeded but the top-bar bell + unread state + mark-all-read UX is missing/basic.
- **Knowledge Assistant chat UI** — RAG works and citations return, but the chat panel could use conversation history, source-doc preview on citation click, and copy-answer.
- **Video lesson player** — video upload flow exists; the player needs proper controls (resume position, playback speed, captions toggle if present, mark-complete on 90%).
- **Projects module** — seeded with data but the UI is minimal (list + basic detail). Milestone kanban / progress bars would make it demo-ready.

## 3. Ops & correctness

- **Playwright E2E type errors** — pre-existing failures in `web/e2e/*.spec.ts` block CI green. Fix types and get `bun run test:e2e` passing headless.
- **`seed:demo` idempotency check** — run it twice locally and confirm no duplicate rows / no FK errors; add a `--reset` flag if not present.
- **Backfill embeddings** — run `npm run backfill:document-embeddings` against the seeded knowledge docs so AI citations are populated out of the box.
- **Env docs** — consolidate `LOCAL_SIGNIN.md` + `PROJECT_CONTEXT.md` + `HANDOFF_TO_ANTIGRAVITY.md` into a single `README.md` quickstart; a lot of drift has accumulated.

## 4. Deployment (Phase from the original roadmap)

- Execute `DEPLOYMENT_RUNBOOK.md` against a staging target (Postgres + Keycloak + MinIO + api + web).
- Wire GitHub Actions to run `bun run test` + `bun run lint` + `bun run build` on PR.
- Add a `/healthz` aggregate check across api + db + storage + keycloak.

## Recommended order

1. **Phase B UI/UX polish** (visible payoff, unblocks screenshots/demo).
2. **Assessments runner + certificates viewer + notifications tray** (fills the last big learner gaps).
3. **Playwright fix + CI green**.
4. **Staging deployment**.

Tell me which of these you want to tackle first (or say "top to bottom" and I'll start with Phase B UI polish).
