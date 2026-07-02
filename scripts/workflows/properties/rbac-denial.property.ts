/**
 * Property Test: RBAC denies unauthorized role-endpoint combinations
 *
 * For any endpoint that requires a specific role, and for any authenticated user
 * whose roles do not include the required role, the API SHALL return HTTP 403 Forbidden.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';
import { AxiosInstance } from 'axios';
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

type Role = 'learner' | 'instructor';
type Method = 'GET' | 'POST';

interface ForbiddenCombination {
  role: Role;
  method: Method;
  path: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSeedResult(): SeedResult {
  const seedPath = path.resolve(__dirname, '../../.validation-seed-result.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

/**
 * The matrix of (role, forbidden endpoint) combinations that MUST return HTTP 403.
 * Each entry represents an endpoint that requires a role the given role does NOT have.
 *
 * - learner: lacks admin/instructor privileges → denied user management, audit logs,
 *   course creation, and department creation.
 * - instructor: lacks admin privileges → denied user management, department creation,
 *   and employee import.
 */
const FORBIDDEN_MATRIX: ForbiddenCombination[] = [
  // Learner is denied admin-only and instructor-only endpoints
  { role: 'learner', method: 'GET', path: '/users' },
  { role: 'learner', method: 'GET', path: '/audit/logs' },
  { role: 'learner', method: 'POST', path: '/courses' },
  { role: 'learner', method: 'POST', path: '/departments' },
  // Instructor is denied admin-only endpoints
  { role: 'instructor', method: 'GET', path: '/users' },
  { role: 'instructor', method: 'POST', path: '/departments' },
  { role: 'instructor', method: 'POST', path: '/employees/import' },
];

/**
 * Perform the HTTP request for a forbidden combination using the appropriate
 * role's API client. The request bodies are intentionally minimal — RBAC
 * enforcement happens before payload validation, so a 403 is expected
 * regardless of body contents.
 */
async function performRequest(
  client: AxiosInstance,
  combo: ForbiddenCombination,
): Promise<number> {
  if (combo.method === 'GET') {
    const res = await client.get(combo.path);
    return res.status;
  }
  const res = await client.post(combo.path, {});
  return res.status;
}

// ─── Property Test Runner ────────────────────────────────────────────────────

/**
 * Runs the property test: RBAC denies unauthorized role-endpoint combinations.
 *
 * This property test verifies that for every (role, forbidden endpoint) pair in
 * the matrix, the authenticated-but-unauthorized role receives exactly HTTP 403.
 * It acquires tokens for the learner and instructor roles and generates arbitrary
 * combinations from the matrix to verify each one is denied.
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runRbacDenialProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();

  // Acquire tokens for the unauthorized roles and build per-role clients.
  const learnerToken = await getToken(seed.users.learner);
  const instructorToken = await getToken(seed.users.instructor);

  const clients: Record<Role, AxiosInstance> = {
    learner: apiClient(learnerToken),
    instructor: apiClient(instructorToken),
  };

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...FORBIDDEN_MATRIX),
        async (combo) => {
          const client = clients[combo.role];
          const status = await performRequest(client, combo);

          // The request MUST be denied with exactly HTTP 403 Forbidden.
          if (status !== 403) {
            throw new Error(
              `Expected ${combo.role} ${combo.method} ${combo.path} to be denied with HTTP 403, ` +
                `but got HTTP ${status}`,
            );
          }
        },
      ),
      { numRuns },
    );

    return {
      property: 'RBAC denies unauthorized role-endpoint combinations',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'RBAC denies unauthorized role-endpoint combinations',
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
  runRbacDenialProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
