# Architecture Decision Records (ADRs)

## ADR-001: Multi-Tenant Data Isolation via Row-Level Filtering

**Status:** Accepted  
**Date:** 2026-05-22

**Context:** The LMS serves multiple organizations (tenants) from a single deployment. We need data isolation without the operational complexity of separate databases per tenant.

**Decision:** Use row-level `tenantId` filtering on all data models. A global `TenantGuard` rejects requests without resolved tenant context. Every service method validates tenantId before querying.

**Consequences:** Simple to implement and scale. Requires discipline to always include tenantId in queries. Indexes on tenantId columns are critical for performance.

---

## ADR-002: Keycloak for Identity & Access Management

**Status:** Accepted  
**Date:** 2026-05-22

**Context:** Enterprise SSO, role management, and token lifecycle need a battle-tested solution.

**Decision:** Use Keycloak as the OIDC provider. Roles are stored in JWT claims and synced to the local User model. The API validates tokens via JWKS endpoint.

**Consequences:** Offloads auth complexity. Requires Keycloak infrastructure. Token refresh handled by the web layer transparently.

---

## ADR-003: Presigned URLs for Large File Uploads

**Status:** Accepted  
**Date:** 2026-05-25

**Context:** Video and SCORM packages can be hundreds of MB. Proxying through the API would be slow and memory-intensive.

**Decision:** Use presigned PUT URLs (MinIO/S3) for direct browser-to-storage uploads. API generates the URL and tracks the upload record; client uploads directly.

**Consequences:** API stays lightweight. Requires CORS configuration on MinIO. Upload confirmation step needed to mark records as ready.

---

## ADR-004: Event-Driven Analytics

**Status:** Accepted  
**Date:** 2026-05-24

**Context:** Analytics data (enrollments, completions, attempts) needs to be tracked without coupling domain services to analytics logic.

**Decision:** Domain services emit events via `EventBus`. An `AnalyticsListener` persists events to the `AnalyticsEvent` table asynchronously. Reporting queries aggregate from this table.

**Consequences:** Domain services remain clean. Analytics failures don't break user flows. Event schema must be maintained as a contract.

---

## ADR-005: Shared LLM Client with Circuit Breaker

**Status:** Accepted  
**Date:** 2026-05-28

**Context:** AI features (tutor, knowledge assistant) depend on external LLM APIs that may be slow or unavailable.

**Decision:** Centralized `LlmClient` with token budget trimming, configurable timeout, and circuit breaker (3 failures → 60s cooldown). Fallback responses returned when circuit is open.

**Consequences:** AI features degrade gracefully. Users always get a response. Circuit breaker prevents cascading failures during LLM outages.

---

## ADR-006: Environment-Driven Feature Flags

**Status:** Accepted  
**Date:** 2026-05-28

**Context:** Some features (AI, SCORM, certificates) may not be needed by all deployments or may need to be disabled during incidents.

**Decision:** Simple `FEATURE_*` environment variables checked by a global `FeatureFlagGuard`. No external feature flag service needed.

**Consequences:** Zero-dependency feature gating. Requires restart to change flags (acceptable for enterprise deployments). Can be upgraded to a dynamic system later if needed.

---

## ADR-007: Global Rate Limiting with Per-Endpoint Overrides

**Status:** Accepted  
**Date:** 2026-05-28

**Context:** API needs protection against abuse without impacting normal usage.

**Decision:** `@nestjs/throttler` with global limits (20 req/s, 100 req/min). Sensitive endpoints (auth: 5/min, AI: 10/min) have stricter limits via `@Throttle()` decorator. Health endpoints skip throttling.

**Consequences:** Simple in-memory rate limiting. Sufficient for single-instance deployments. For multi-instance, would need Redis-backed throttler.

---

## ADR-008: Course Publish Workflow with super_admin Gate

**Status:** Accepted
**Date:** 2026-07-04

**Context:** Instructors need to author courses freely, but published content is customer-visible and must be reviewed. Admins run the tenant day-to-day but shouldn't unilaterally push content live.

**Decision:** Courses move through a four-state lifecycle: `draft → review → published → archived`. Instructors create drafts and submit for review. Only `super_admin` may publish out of review. `admin` and `super_admin` may archive or unpublish. Instructor-scoped `PATCH /courses/:id` is additionally gated at the service layer: edits are rejected with `403` when the course is in `review` or `published`. The frontend hides the Edit action and shows a read-only notice for parity, but the backend is authoritative.

**Consequences:** Clear separation of authoring vs. release authority. Prevents an instructor from silently editing a published course via a direct API call. Publishing throughput depends on `super_admin` availability — acceptable given the audit and compliance requirements of an enterprise LMS.

---

## ADR-009: Multi-Select Status + Category Filter UX for Course List

**Status:** Accepted
**Date:** 2026-07-05

**Context:** The dashboard course list has to serve four roles with very different mental models (learner browses published, instructor toggles between drafts/review/archived, admin/super_admin see everything). A single dropdown filter created hidden state and made role-specific defaults awkward.

**Decision:** Render status and category as always-visible chip rows above the list. Chips are multi-select; toggling all off snaps back to a sensible role-scoped default (learners → `published`). Chips render outside the async data boundary so they remain visible during empty result sets, alongside a shared `EmptyState`. Category chips only render when the tenant has categories defined.

**Consequences:** Filter state is discoverable at a glance and share-friendly. No hidden combinations. Slightly more vertical space than a dropdown, which is acceptable on the dashboard layout. Combined status × category filtering is expressed by simple set intersection in the client.
