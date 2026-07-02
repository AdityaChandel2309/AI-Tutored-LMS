# Copilot instructions for LMS

## Build, test, and lint

### API (`api/`)
- Install: `npm install`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm test`
- Single test: `npm test -- path/to/file.spec.ts`
- E2E tests: `npm run test:e2e`
- Single E2E test: `npm run test:e2e -- path/to/test.e2e-spec.ts`
- Live auth acceptance: `npm run test:live`

### Web (`web/`)
- Install: `npm install`
- Dev server: `npm run dev` (or `npm run dev:turbo`)
- Build: `npm run build`
- Lint: `npm run lint`
- Playwright: `npm run test:acceptance`
- Single Playwright test: `npx playwright test path/to/spec.ts` (or `npm run test:acceptance -- path/to/spec.ts`)

## High-level architecture
- Monorepo with `api/` (NestJS + Prisma) and `web/` (Next.js App Router). Local infra uses `docker-compose.yml` for Postgres, Redis, Keycloak, and MinIO; Keycloak realm config lives in `keycloak/realm-config.json`.
- Auth is Keycloak-based: backend validates JWT via JWKS and resolves tenant context; the web app stores tokens in HttpOnly cookies and proxies backend calls through Next.js API routes under `web/src/app/api`.
- Backend responses are wrapped by `ResponseEnvelopeInterceptor` as `{ data, meta }`. Web API routes call `relayBackendDataResponse` to unwrap the envelope before React code consumes it.
- Course domain is implemented across API modules (`api/src/course`, `category`, `module`, `lesson`, `progress`, `events`) with Prisma models and a domain event bus. The UI uses typed API client helpers (`web/src/lib/api/client.ts`), centralized TanStack Query hooks (`web/src/lib/api/*`), and shared types (`web/src/lib/types/*`).
- Video pipeline work is defined in `docs/adr/001-video-ownership-architecture.md`: MinIO-first storage, presigned upload/stream URLs, single bucket with tenant-prefixed keys, and no transcoding/thumbnailing in MVP.

## Key conventions
- Use `proxyBackendRequest` (web/src/lib/server-session.ts) for server-side calls so tenant headers and refresh handling are applied; pair it with `relayBackendDataResponse` in API routes.
- Keep tenant scoping strict on the API side; domain queries are expected to filter by the resolved tenant, and tenant headers are required for backend calls.
- Frontend data access should go through `lib/api/client.ts` and the typed hooks in `lib/api/*` to keep query keys and invalidation centralized.
- When you need a direct fetch, use `getApiUrl` with `credentials: "include"` to preserve the session cookie flow.
- Respect the response envelope: backend returns `{ data, meta }` and errors as `{ error }`; frontend types assume the envelope is unwrapped.
- Prefer the shared design-system primitives from `@/components/ui/` (Button, Card, Field, Notice, SectionHeading, Stat, etc.) and tokens from `web/src/app/globals.css` before adding one-off styles. Use `class-variance-authority` for component variants.
- `EventBus.emit` expects a `DomainEvent` (`{ type, tenantId, timestamp, payload }`). Video domain events live in `api/src/events/domain-events.ts`.
- Use `"use client"` in interactive Next.js components and follow the existing dashboard loading/error patterns.
- Keep `PROJECT_CONTEXT.md` and `.claude-flow/hive-mind/state.json` updated after each meaningful milestone or workflow change.
- This Next.js version includes breaking changes; consult `node_modules/next/dist/docs/` before using unfamiliar APIs (per `web/CLAUDE.md`).
