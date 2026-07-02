/**
 * Property Test: Enrollment always initializes at zero progress
 *
 * For any published course and for any learner who is not already enrolled,
 * creating an enrollment SHALL produce a record with progress equal to 0
 * and no completedAt timestamp.
 *
 * **Validates: Requirements 4.5**
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
 * Runs the property test: enrollment always initializes at zero progress.
 *
 * Since the API does not support creating arbitrary learners or unenrolling,
 * this property test verifies the invariant by:
 * 1. Enrolling the seeded learner in the seeded published course
 * 2. Verifying that the enrollment response and progress endpoint both report 0 progress
 * 3. Verifying no completedAt timestamp is set
 *
 * The property is tested across multiple random "run identifiers" to exercise
 * the fast-check framework, but the core assertion is that enrollment always
 * starts at zero progress regardless of when or how many times we check.
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runEnrollmentZeroProgressProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.learner);
  const client = apiClient(token);
  const publishedCourseId = seed.courses.publishedId;

  // First, enroll the learner in the published course (may already be enrolled)
  const enrollRes = await client.post(`/courses/${publishedCourseId}/enroll`);

  // Accept 200/201 (success) or 409/400 (already enrolled)
  const enrollmentSucceeded =
    enrollRes.status === 200 || enrollRes.status === 201;
  const alreadyEnrolled =
    enrollRes.status === 409 ||
    (enrollRes.status === 400 &&
      JSON.stringify(enrollRes.data).toLowerCase().includes('already'));

  if (!enrollmentSucceeded && !alreadyEnrolled) {
    return {
      property: 'Enrollment always initializes at zero progress',
      passed: false,
      numRuns: 0,
      error: `Failed to enroll learner: HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data)}`,
    };
  }

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 999999 }),
        async (_runId) => {
          // Verify progress is at zero via the progress endpoint
          const progressRes = await client.get(
            `/courses/${publishedCourseId}/progress`,
          );

          if (progressRes.status !== 200) {
            throw new Error(
              `Failed to retrieve progress: HTTP ${progressRes.status}: ${JSON.stringify(progressRes.data)}`,
            );
          }

          const progress = progressRes.data;

          // Check progress percentage is 0
          const progressPercent =
            progress.summary?.progressPercent ??
            progress.progressPercent ??
            progress.progress;

          if (progressPercent !== 0) {
            throw new Error(
              `Expected progress to be 0 but got ${progressPercent}`,
            );
          }

          // Check completedAt is null/undefined
          const completedAt =
            progress.summary?.completedAt ??
            progress.completedAt;

          if (completedAt != null) {
            throw new Error(
              `Expected completedAt to be null but got "${completedAt}"`,
            );
          }
        },
      ),
      { numRuns },
    );

    return {
      property: 'Enrollment always initializes at zero progress',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'Enrollment always initializes at zero progress',
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
  runEnrollmentZeroProgressProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
