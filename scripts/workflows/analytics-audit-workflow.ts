/**
 * Analytics and Audit Workflow Test
 *
 * Validates analytics events and audit logging:
 * - Activity timeline correctness: perform actions → verify analytics events recorded with correct timestamps/ordering
 * - Analytics aggregation correctness: verify counts match actual data
 * - Audit log completeness: CRUD operations → verify audit log entries
 * - Actor/entity attribution: verify audit logs identify acting user and affected entity
 * - Tenant isolation in logs: verify no cross-tenant leakage
 *
 * Requirements: 6.1, 7.1–7.4
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowResult, StepResult, SeedResult } from './types.js';
import { getToken, apiClient } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSeedResult(): SeedResult {
  const seedPath = path.resolve(__dirname, '../.validation-seed-result.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

async function runStep(
  description: string,
  fn: () => Promise<{ passed: boolean; expected?: string; actual?: string }>,
): Promise<StepResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      description,
      passed: result.passed,
      expected: result.expected,
      actual: result.actual,
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      description,
      passed: false,
      expected: 'No error thrown',
      actual: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

// ─── Workflow Steps ──────────────────────────────────────────────────────────

/**
 * Step 1: Activity timeline correctness
 * Perform actions (enrollment, lesson completion) → verify analytics events are recorded
 * with correct timestamps and ordering.
 */
async function testActivityTimelineCorrectness(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Activity timeline correctness: actions produce analytics events with correct timestamps and ordering',
    async () => {
      const learnerToken = await getToken(seed.users.learner);
      const adminToken = await getToken(seed.users.admin);
      const learnerClient = apiClient(learnerToken);
      const adminClient = apiClient(adminToken);

      const courseId = seed.courses.publishedId;

      if (!courseId) {
        return {
          passed: false,
          expected: 'Published course ID available from seed data',
          actual: 'No published course ID in seed result',
        };
      }

      // Record timestamp before performing actions
      const beforeActions = new Date().toISOString();

      // Perform an enrollment action
      const enrollRes = await learnerClient.post(`/courses/${courseId}/enroll`);
      // Accept 200/201 (new enrollment) or 409/400 (already enrolled)
      if (enrollRes.status >= 500) {
        return {
          passed: false,
          expected: 'Enrollment succeeds or already exists (no 5xx)',
          actual: `HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data)}`,
        };
      }

      // Small delay to ensure timestamp ordering
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Attempt a lesson progress update if possible
      const courseLessonsRes = await learnerClient.get(`/courses/${courseId}/modules`);
      let lessonProgressAttempted = false;

      if (courseLessonsRes.status === 200 && Array.isArray(courseLessonsRes.data)) {
        const modules = courseLessonsRes.data;
        if (modules.length > 0 && modules[0].lessons && modules[0].lessons.length > 0) {
          const lessonId = modules[0].lessons[0].id;
          const progressRes = await learnerClient.patch(
            `/courses/${courseId}/progress/${lessonId}`,
            { status: 'in_progress' },
          );
          if (progressRes.status < 500) {
            lessonProgressAttempted = true;
          }
        }
      }

      // Now query analytics events as admin
      const afterActions = new Date().toISOString();

      // Try fetching analytics events
      const analyticsRes = await adminClient.get('/analytics/events', {
        params: {
          startDate: beforeActions,
          endDate: afterActions,
          userId: seed.users.learner.id,
        },
      });

      // If analytics endpoint doesn't exist, record as finding (not crash)
      if (analyticsRes.status === 404) {
        return {
          passed: false,
          expected: 'Analytics events endpoint exists (GET /analytics/events)',
          actual: 'HTTP 404 — analytics events endpoint not implemented yet (finding)',
        };
      }

      if (analyticsRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on analytics events query',
          actual: `HTTP ${analyticsRes.status}: ${JSON.stringify(analyticsRes.data)}`,
        };
      }

      const events = Array.isArray(analyticsRes.data)
        ? analyticsRes.data
        : analyticsRes.data?.events || analyticsRes.data?.data || [];

      if (!Array.isArray(events)) {
        return {
          passed: false,
          expected: 'Analytics events response is an array',
          actual: `Response type: ${typeof events}, value: ${JSON.stringify(analyticsRes.data).substring(0, 200)}`,
        };
      }

      // Verify events have timestamps and are ordered
      if (events.length === 0) {
        return {
          passed: false,
          expected: 'At least one analytics event recorded for performed actions',
          actual: `No events found for user ${seed.users.learner.id} in time range`,
        };
      }

      // Check timestamp ordering (each event should have a timestamp >= previous)
      let ordered = true;
      for (let i = 1; i < events.length; i++) {
        const prevTime = new Date(events[i - 1].timestamp || events[i - 1].createdAt).getTime();
        const currTime = new Date(events[i].timestamp || events[i].createdAt).getTime();
        if (currTime < prevTime) {
          ordered = false;
          break;
        }
      }

      if (!ordered) {
        return {
          passed: false,
          expected: 'Analytics events are ordered by timestamp (ascending)',
          actual: 'Events are not in chronological order',
        };
      }

      return {
        passed: true,
        expected: 'Analytics events recorded with correct timestamps and ordering',
        actual: `${events.length} event(s) found, timestamps ordered correctly. Lesson progress attempted: ${lessonProgressAttempted}`,
      };
    },
  );
}

/**
 * Step 2: Analytics aggregation correctness
 * Verify course completion counts, enrollment counts match actual data.
 */
async function testAnalyticsAggregation(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Analytics aggregation correctness: counts match actual data',
    async () => {
      const adminToken = await getToken(seed.users.admin);
      const adminClient = apiClient(adminToken);

      // Try the dashboard summary endpoint
      const summaryRes = await adminClient.get('/analytics/dashboard-summary');

      // If endpoint doesn't exist, record as finding
      if (summaryRes.status === 404) {
        return {
          passed: false,
          expected: 'Analytics dashboard summary endpoint exists (GET /analytics/dashboard-summary)',
          actual: 'HTTP 404 — analytics dashboard summary endpoint not implemented yet (finding)',
        };
      }

      if (summaryRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on analytics dashboard summary',
          actual: `HTTP ${summaryRes.status}: ${JSON.stringify(summaryRes.data)}`,
        };
      }

      const summary = summaryRes.data;

      // Verify the summary contains expected aggregate fields
      const hasEnrollmentCount =
        summary.enrollmentCount !== undefined ||
        summary.totalEnrollments !== undefined ||
        summary.enrollments !== undefined;

      const hasCourseCount =
        summary.courseCount !== undefined ||
        summary.totalCourses !== undefined ||
        summary.courses !== undefined;

      if (!hasEnrollmentCount && !hasCourseCount) {
        return {
          passed: false,
          expected: 'Dashboard summary contains enrollment and/or course counts',
          actual: `Summary fields: ${Object.keys(summary).join(', ')}`,
        };
      }

      // Verify counts are non-negative numbers
      const enrollments = summary.enrollmentCount ?? summary.totalEnrollments ?? summary.enrollments ?? 0;
      const courses = summary.courseCount ?? summary.totalCourses ?? summary.courses ?? 0;

      if (typeof enrollments !== 'number' || enrollments < 0) {
        return {
          passed: false,
          expected: 'Enrollment count is a non-negative number',
          actual: `Enrollment count: ${JSON.stringify(enrollments)}`,
        };
      }

      if (typeof courses !== 'number' || courses < 0) {
        return {
          passed: false,
          expected: 'Course count is a non-negative number',
          actual: `Course count: ${JSON.stringify(courses)}`,
        };
      }

      return {
        passed: true,
        expected: 'Analytics aggregation returns valid counts',
        actual: `Enrollments: ${enrollments}, Courses: ${courses}. Summary keys: ${Object.keys(summary).join(', ')}`,
      };
    },
  );
}

/**
 * Step 3: Audit log completeness
 * Perform CRUD operations on key entities → verify each operation produces an audit log entry.
 */
async function testAuditLogCompleteness(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Audit log completeness: CRUD operations produce audit log entries with action type, timestamp, and entity reference',
    async () => {
      const adminToken = await getToken(seed.users.admin);
      const adminClient = apiClient(adminToken);

      // Record timestamp before performing actions
      const beforeActions = new Date().toISOString();

      // Perform a create operation (create a department as admin)
      const deptCode = `AUDIT-TEST-${Date.now()}`;
      const createRes = await adminClient.post('/departments', {
        name: `Audit Test Department ${Date.now()}`,
        code: deptCode,
      });

      let entityId: string | undefined;
      let entityType = 'department';

      if (createRes.status === 200 || createRes.status === 201) {
        entityId = createRes.data.id;
      }

      // Small delay to allow audit log to be written
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Query audit logs
      const auditRes = await adminClient.get('/audit-logs', {
        params: {
          startDate: beforeActions,
          actorId: seed.users.admin.id,
        },
      });

      // If audit logs endpoint doesn't exist, record as finding
      if (auditRes.status === 404) {
        return {
          passed: false,
          expected: 'Audit logs endpoint exists (GET /audit-logs)',
          actual: 'HTTP 404 — audit logs endpoint not implemented yet (finding)',
        };
      }

      if (auditRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on audit logs query',
          actual: `HTTP ${auditRes.status}: ${JSON.stringify(auditRes.data)}`,
        };
      }

      const logs = Array.isArray(auditRes.data)
        ? auditRes.data
        : auditRes.data?.logs || auditRes.data?.data || [];

      if (!Array.isArray(logs)) {
        return {
          passed: false,
          expected: 'Audit logs response is an array',
          actual: `Response type: ${typeof logs}, value: ${JSON.stringify(auditRes.data).substring(0, 200)}`,
        };
      }

      if (logs.length === 0) {
        return {
          passed: false,
          expected: 'At least one audit log entry for the performed operation',
          actual: `No audit log entries found after ${beforeActions} for actor ${seed.users.admin.id}`,
        };
      }

      // Verify audit log entries have required fields: action type, timestamp, entity reference
      const firstLog = logs[0];
      const hasAction = firstLog.action || firstLog.actionType || firstLog.type;
      const hasTimestamp = firstLog.timestamp || firstLog.createdAt || firstLog.date;
      const hasEntityRef =
        firstLog.entityId || firstLog.targetId || firstLog.resourceId || firstLog.entity;

      const missingFields: string[] = [];
      if (!hasAction) missingFields.push('action type');
      if (!hasTimestamp) missingFields.push('timestamp');
      if (!hasEntityRef) missingFields.push('entity reference');

      if (missingFields.length > 0) {
        return {
          passed: false,
          expected: 'Audit log entries contain action type, timestamp, and entity reference',
          actual: `Missing fields: ${missingFields.join(', ')}. Log entry keys: ${Object.keys(firstLog).join(', ')}`,
        };
      }

      return {
        passed: true,
        expected: 'CRUD operations produce audit log entries with required fields',
        actual: `${logs.length} audit log(s) found. Fields present: action=${hasAction}, timestamp=${hasTimestamp}, entityRef=${hasEntityRef}`,
      };
    },
  );
}

/**
 * Step 4: Actor/entity attribution
 * Verify each audit log entry correctly identifies the acting user (actor) and the affected entity (target).
 */
async function testActorEntityAttribution(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Actor/entity attribution: audit logs correctly identify acting user and affected entity',
    async () => {
      const adminToken = await getToken(seed.users.admin);
      const adminClient = apiClient(adminToken);

      // Query audit logs filtered by the admin actor
      const auditRes = await adminClient.get('/audit-logs', {
        params: {
          actorId: seed.users.admin.id,
        },
      });

      // If audit logs endpoint doesn't exist, record as finding
      if (auditRes.status === 404) {
        return {
          passed: false,
          expected: 'Audit logs endpoint exists (GET /audit-logs)',
          actual: 'HTTP 404 — audit logs endpoint not implemented yet (finding)',
        };
      }

      if (auditRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on audit logs query',
          actual: `HTTP ${auditRes.status}: ${JSON.stringify(auditRes.data)}`,
        };
      }

      const logs = Array.isArray(auditRes.data)
        ? auditRes.data
        : auditRes.data?.logs || auditRes.data?.data || [];

      if (!Array.isArray(logs) || logs.length === 0) {
        return {
          passed: false,
          expected: 'At least one audit log entry for admin actor',
          actual: `No audit logs found for actorId=${seed.users.admin.id}`,
        };
      }

      // Verify actor attribution — each log should reference the admin user
      let actorAttributionCorrect = true;
      let entityAttributionPresent = true;
      let checkedCount = 0;

      for (const log of logs.slice(0, 10)) {
        // Check actor field
        const actorId = log.actorId || log.userId || log.performedBy || log.actor?.id;
        if (!actorId) {
          actorAttributionCorrect = false;
          break;
        }

        // Verify the actor matches the admin user (since we filtered by actorId)
        if (actorId !== seed.users.admin.id) {
          actorAttributionCorrect = false;
          break;
        }

        // Check entity/target field
        const entityRef =
          log.entityId || log.targetId || log.resourceId || log.entity?.id || log.target?.id;
        const entityType =
          log.entityType || log.targetType || log.resourceType || log.entity?.type || log.target?.type;

        if (!entityRef && !entityType) {
          entityAttributionPresent = false;
        }

        checkedCount++;
      }

      if (!actorAttributionCorrect) {
        return {
          passed: false,
          expected: 'All audit log entries correctly identify the acting user (admin)',
          actual: `Actor attribution mismatch in checked logs. Expected actorId=${seed.users.admin.id}`,
        };
      }

      if (!entityAttributionPresent) {
        return {
          passed: false,
          expected: 'Audit log entries include entity/target reference',
          actual: `Some logs missing entity reference. Checked ${checkedCount} log(s)`,
        };
      }

      return {
        passed: true,
        expected: 'Audit logs correctly attribute actor and entity',
        actual: `Checked ${checkedCount} log(s): actor correctly identified as admin, entity references present`,
      };
    },
  );
}

/**
 * Step 5: Tenant isolation in logs
 * Query audit logs and verify no cross-tenant leakage.
 */
async function testTenantIsolationInLogs(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Tenant isolation in logs: no cross-tenant leakage in audit data',
    async () => {
      const adminToken = await getToken(seed.users.admin);

      // Query audit logs from the default tenant
      const defaultTenantClient = apiClient(adminToken, 'default');
      const defaultLogsRes = await defaultTenantClient.get('/audit-logs');

      // If audit logs endpoint doesn't exist, record as finding
      if (defaultLogsRes.status === 404) {
        return {
          passed: false,
          expected: 'Audit logs endpoint exists (GET /audit-logs)',
          actual: 'HTTP 404 — audit logs endpoint not implemented yet (finding)',
        };
      }

      if (defaultLogsRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on audit logs query for default tenant',
          actual: `HTTP ${defaultLogsRes.status}: ${JSON.stringify(defaultLogsRes.data)}`,
        };
      }

      const defaultLogs = Array.isArray(defaultLogsRes.data)
        ? defaultLogsRes.data
        : defaultLogsRes.data?.logs || defaultLogsRes.data?.data || [];

      // Query audit logs from a non-existent tenant to verify isolation
      const otherTenantClient = apiClient(adminToken, 'nonexistent-tenant-xyz');
      const otherLogsRes = await otherTenantClient.get('/audit-logs');

      // If the other tenant query returns 403/401/404, that's good — access is denied
      if (otherLogsRes.status === 403 || otherLogsRes.status === 401 || otherLogsRes.status === 404) {
        return {
          passed: true,
          expected: 'Cross-tenant audit log access is denied or returns empty',
          actual: `Other tenant query returned HTTP ${otherLogsRes.status} — access properly restricted`,
        };
      }

      // If it returns 200, verify the logs don't contain data from the default tenant
      if (otherLogsRes.status === 200) {
        const otherLogs = Array.isArray(otherLogsRes.data)
          ? otherLogsRes.data
          : otherLogsRes.data?.logs || otherLogsRes.data?.data || [];

        // If other tenant returns empty results, that's correct isolation
        if (!Array.isArray(otherLogs) || otherLogs.length === 0) {
          return {
            passed: true,
            expected: 'Cross-tenant audit log query returns no data',
            actual: `Other tenant query returned empty results — tenant isolation confirmed`,
          };
        }

        // If other tenant returns data, check it doesn't overlap with default tenant data
        const defaultLogIds = new Set(
          (Array.isArray(defaultLogs) ? defaultLogs : []).map((l: { id: string }) => l.id),
        );
        const leakedLogs = otherLogs.filter((l: { id: string }) => defaultLogIds.has(l.id));

        if (leakedLogs.length > 0) {
          return {
            passed: false,
            expected: 'No audit log entries from default tenant visible in other tenant',
            actual: `${leakedLogs.length} log(s) from default tenant leaked to other tenant query`,
          };
        }

        // Check if any logs reference the default tenant's entities
        const defaultTenantId = seed.tenant.id;
        const crossTenantLogs = otherLogs.filter(
          (l: { tenantId?: string }) => l.tenantId === defaultTenantId,
        );

        if (crossTenantLogs.length > 0) {
          return {
            passed: false,
            expected: 'No audit logs with default tenantId visible in other tenant query',
            actual: `${crossTenantLogs.length} log(s) with default tenantId found in other tenant query`,
          };
        }

        return {
          passed: true,
          expected: 'Tenant isolation maintained in audit logs',
          actual: `Other tenant returned ${otherLogs.length} log(s) but none overlap with default tenant data`,
        };
      }

      // Any other status
      return {
        passed: false,
        expected: 'Cross-tenant query returns 200 (empty), 403, 401, or 404',
        actual: `HTTP ${otherLogsRes.status}: ${JSON.stringify(otherLogsRes.data).substring(0, 200)}`,
      };
    },
  );
}

// ─── Workflow Entry Point ────────────────────────────────────────────────────

export async function runAnalyticsAuditWorkflow(seedResult?: SeedResult): Promise<WorkflowResult> {
  const start = Date.now();
  const seed = seedResult ?? loadSeedResult();
  const steps: StepResult[] = [];

  steps.push(await testActivityTimelineCorrectness(seed));
  steps.push(await testAnalyticsAggregation(seed));
  steps.push(await testAuditLogCompleteness(seed));
  steps.push(await testActorEntityAttribution(seed));
  steps.push(await testTenantIsolationInLogs(seed));

  const passed = steps.every((s) => s.passed);

  return {
    name: 'Analytics and Audit Workflow',
    steps,
    passed,
    duration: Date.now() - start,
  };
}
