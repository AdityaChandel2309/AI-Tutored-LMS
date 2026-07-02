/**
 * Property Test: Non-published course enrollment is always rejected
 *
 * For any course with status other than "published" (draft, review, or archived),
 * for any learner, an enrollment attempt SHALL be rejected with an error response (4xx).
 *
 * **Validates: Requirements 4.9**
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

// ─── Property Test Runner ────────────────────────────────────────────────────

/**
 * Runs the property test: non-published course enrollment is always rejected.
 *
 * This property test verifies that enrollment attempts against courses that are
 * NOT in "published" status are always rejected with a 4xx error response.
 * It uses the seeded draft and review courses and generates arbitrary enrollment
 * attempts to verify each one is rejected.
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runNonPublishedEnrollmentRejectionProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.learner);
  const client = apiClient(token);

  // Non-published course IDs from seed data
  const nonPublishedCourses = [
    { id: seed.courses.draftId, status: 'draft' },
    { id: seed.courses.reviewId, status: 'review' },
  ];

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...nonPublishedCourses),
        fc.nat({ max: 999999 }),
        async (course, _attemptId) => {
          // Attempt to enroll in the non-published course
          const enrollRes = await client.post(`/courses/${course.id}/enroll`);

          // The enrollment MUST be rejected with a 4xx status code
          const isRejected =
            enrollRes.status >= 400 && enrollRes.status < 500;

          if (!isRejected) {
            throw new Error(
              `Expected enrollment in ${course.status} course (${course.id}) to be rejected with 4xx, ` +
              `but got HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data)}`,
            );
          }
        },
      ),
      { numRuns },
    );

    return {
      property: 'Non-published course enrollment is always rejected',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'Non-published course enrollment is always rejected',
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
  runNonPublishedEnrollmentRejectionProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
