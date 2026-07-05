# Web (`@lms/web`)

Next.js 15 App Router frontend for the LMS platform. TanStack Query for data, typed API client, session cookies proxied to the NestJS API.

> **First-time setup lives in the root `../README.md`.** This file only covers day-to-day web work.

## Quick start (this workspace only)

```bash
# from repo root
npm install

# from web/
cp .env.local.example .env.local
npm run dev                     # next dev on :3001
```

Open <http://localhost:3001>. The dev server proxies API calls to `http://localhost:3000` — start the API first (see `../api/README.md`).

## Common scripts

```bash
npm run dev                     # next dev on :3001
npm run build                   # next build
npm run start                   # next start (production)
npm run lint

bunx tsgo --noEmit              # fast typecheck (includes Playwright specs)
bun run test:e2e                # Playwright acceptance (requires full stack running)
```

## Layout

```
src/
  app/
    login/  callback/           Keycloak sign-in
    dashboard/                  Authenticated app shell (courses, projects, employees,
                                knowledge, ai-tutor, analytics, audit, settings)
    verify/[code]/              Public certificate verification page
    api/                        Next.js Route Handlers that proxy to the NestJS API
  components/
    course-builder/             Wizard for course + module + lesson authoring
    ui/                         Shared primitives (Button, Card, Field, Notice, …)
  lib/
    api/                        Typed fetchers per module (courses, projects, …)
    session.ts  server-session.ts  Cookie-scoped session helpers
    tenant.ts  auth.ts  brand.ts   Tenant + brand config
e2e/                            Playwright specs + shared support
```

## Key environment variables

See `.env.local.example` for the full list.

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Public API base (browser + SSR) |
| `API_INTERNAL_URL` | Server-side API base for proxy Route Handlers |
| `KEYCLOAK_BASE_URL` / `KEYCLOAK_REALM` / `KEYCLOAK_CLIENT_ID` | OIDC issuer info for the login redirect |
| `SESSION_COOKIE_NAME` / `SESSION_SECRET` | httpOnly session cookie |

## Design system

Shared primitives and usage rules live in `DESIGN_SYSTEM_BASELINE.md`. Prefer those before adding one-off classes.

## Further reading

- `../README.md` — repo entry point + Quickstart
- `../docs/ARCHITECTURE.md` — system diagram
- `../docs/RBAC_MATRIX.md` — what each role can do
- `DESIGN_SYSTEM_BASELINE.md` — shared UI primitives