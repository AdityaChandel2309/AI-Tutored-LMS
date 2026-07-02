/**
 * Property Test: Entity creation is tenant-isolated
 *
 * For any entity created within tenant A (departments, courses, documents,
 * projects), querying from tenant B SHALL never return that entity.
 *
 * **Validates: Requirements 6.1**
 */

import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';
import { SeedResult } from '../types.js';
import { getToken, apiClient } from '../helpers.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyTestResult {
  property: string;
  passed: boolean;
  numRuns: number;
  counterexample?: unknown;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSeedResult(): SeedResult {
  const seedPath = path.resolve(__dirname, '../../.validation-seed-result.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

interface SeededEntity {
  kind: string;
  path: string;
  id: string;
}

/**
 * Determine whether a cross-tenant response leaked the target entity.
 * The entity is considered leaked only when the request succeeded (HTTP 200)
 * AND the response body references the same entity id.
 */
function entityLeaked(status: number, data: unknown, entityId: string): boolean {
  if (status !== 200) {
    return false;
  }

  if (data == null) {
    return false;
  }

  const body = data as Record<string, unknown>;
  if (body.id === entityId) {
    return true;
  }

  // Some endpoints may wrap the entity in a collection — guard against that too.
  if (Array.isArray(body)) {
    return (body as Array<Record<string, unknown>>).some((item) => item?.id === entityId);
  }

  return false;
}

// ─── Property Test Runner ────────────────────────────────────────────────────

/**
 * Runs the property test: entity creation is tenant-isolated.
 *
 * Using the seeded entities (departments and the published course) created in
 * the "default" tenant, this property verifies that:
 * 1. Each entity is retrievable when queried through the "default" tenant client.
 * 2. The SAME entity id is never returned when queried through an arbitrary
 *    other tenant subdomain (which resolves to a different — or no — tenant).
 *
 * The "other tenant" subdomain is generated arbitrarily by fast-check and is
 * guaranteed to differ from "default".
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runTenantIsolationProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.admin);
  const defaultClient = apiClient(token, 'default');

  // Tenant-scoped entities seeded in the "default" tenant.
  const entities: SeededEntity[] = [
    {
      kind: 'department',
      path: `/departments/${seed.departments.parentId}`,
      id: seed.departments.parentId,
    },
    {
      kind: 'department',
      path: `/departments/${seed.departments.childId}`,
      id: seed.departments.childId,
    },
    {
      kind: 'course',
      path: `/courses/${seed.courses.publishedId}`,
      id: seed.courses.publishedId,
    },
  ];

  // Arbitrary "other tenant" subdomains that are never equal to "default" and
  // are extremely unlikely to collide with any real tenant.
  const otherTenantArb = fc
    .string({ minLength: 0, maxLength: 20 })
    .map((s) => `nonexistent-tenant-${s.toLowerCase().replace(/[^a-z0-9]/g, '')}`)
    .filter((subdomain) => subdomain !== 'default');

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...entities),
        otherTenantArb,
        async (entity, otherTenant) => {
          // 1. The entity MUST be retrievable from its owning ("default") tenant.
          const defaultRes = await defaultClient.get(entity.path);
          if (defaultRes.status !== 200) {
            throw new Error(
              `Expected ${entity.kind} (${entity.id}) to be retrievable from the "default" tenant, ` +
              `but got HTTP ${defaultRes.status}: ${JSON.stringify(defaultRes.data)}`,
            );
          }

          // 2. Querying the SAME entity id from a different tenant MUST NOT return it.
          const otherClient = apiClient(token, otherTenant);
          const crossRes = await otherClient.get(entity.path);

          if (entityLeaked(crossRes.status, crossRes.data, entity.id)) {
            throw new Error(
              `Tenant isolation violated: ${entity.kind} (${entity.id}) created in tenant "default" ` +
              `was returned when queried from tenant "${otherTenant}" ` +
              `(HTTP ${crossRes.status}): ${JSON.stringify(crossRes.data)}`,
            );
          }
        },
      ),
      { numRuns },
    );

    return {
      property: 'Entity creation is tenant-isolated',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'Entity creation is tenant-isolated',
      passed: false,
      numRuns,
      counterexample: error.counterexample ?? undefined,
      error: error.message,
    };
  }
}

// ─── Direct Execution ────────────────────────────────────────────────────────

if (require.main === module) {
  const numRuns = parseInt(process.env.NUM_RUNS || '10', 10);
  runTenantIsolationProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
