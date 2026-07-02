/**
 * Property Test: Unauthenticated requests receive 401
 *
 * For any protected endpoint, a request without a valid Authorization header
 * SHALL receive HTTP 401 Unauthorized.
 *
 * **Validates: Requirements 7.4**
 */

import fc from 'fast-check';
import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyTestResult {
  property: string;
  passed: boolean;
  numRuns: number;
  counterexample?: unknown;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Protected endpoints that require authentication. A request to any of these
 * without a valid Authorization header MUST be rejected with HTTP 401.
 */
const PROTECTED_ENDPOINTS: { method: 'get' | 'post'; path: string }[] = [
  { method: 'get', path: '/users' },
  { method: 'get', path: '/courses' },
  { method: 'post', path: '/courses' },
  { method: 'get', path: '/audit/logs' },
  { method: 'get', path: '/documents' },
  { method: 'get', path: '/projects' },
];

// ─── Property Test Runner ────────────────────────────────────────────────────

/**
 * Runs the property test: unauthenticated requests receive 401.
 *
 * This property test verifies that requests to protected endpoints WITHOUT an
 * Authorization header are always rejected with HTTP 401 Unauthorized. It uses
 * raw axios with `validateStatus: () => true` so non-2xx responses are not
 * thrown, sending only the tenant header and no Authorization header.
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runUnauthenticatedRejectionProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  try {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...PROTECTED_ENDPOINTS),
        async (endpoint) => {
          const url = `${API_BASE_URL}${endpoint.path}`;
          // Send the request WITHOUT an Authorization header — only the tenant
          // header is included. validateStatus lets us inspect any status code.
          const res =
            endpoint.method === 'post'
              ? await axios.post(url, {}, {
                  headers: { 'x-tenant-subdomain': 'default' },
                  validateStatus: () => true,
                })
              : await axios.get(url, {
                  headers: { 'x-tenant-subdomain': 'default' },
                  validateStatus: () => true,
                });

          // The unauthenticated request MUST be rejected with exactly HTTP 401.
          if (res.status !== 401) {
            throw new Error(
              `Expected unauthenticated ${endpoint.method.toUpperCase()} ${endpoint.path} ` +
              `to be rejected with HTTP 401, but got HTTP ${res.status}: ${JSON.stringify(res.data)}`,
            );
          }
        },
      ),
      { numRuns },
    );

    return {
      property: 'Unauthenticated requests receive 401',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'Unauthenticated requests receive 401',
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
  runUnauthenticatedRejectionProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
