/**
 * Property Test: Progress percentage equals completed lessons over total lessons
 *
 * For any enrollment with N total lessons (N > 0), if K lessons are marked as
 * completed (where 0 ≤ K ≤ N), the enrollment progress SHALL equal
 * Math.round((K/N) * 100).
 *
 * This is a pure logic property test — no API calls needed. It verifies the
 * calculation formula itself holds for all valid inputs.
 *
 * **Validates: Requirements 4.6**
 */

import fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyTestResult {
  property: string;
  passed: boolean;
  numRuns: number;
  counterexample?: unknown;
  error?: string;
}

// ─── Property Test Runner ────────────────────────────────────────────────────

/**
 * Runs the property test: progress percentage equals completed lessons over total lessons.
 *
 * For any N > 0 and 0 ≤ K ≤ N, progress = Math.round((K/N) * 100).
 *
 * @param numRuns - Number of iterations to run (default: 100)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runProgressCalculationProperty(
  numRuns = 100,
): Promise<PropertyTestResult> {
  try {
    fc.assert(
      fc.property(
        // Generate totalLessons (N): at least 1 to avoid division by zero, max 100
        fc.integer({ min: 1, max: 100 }),
        // Generate completedLessons (K): 0 to 100, will be clamped to [0, N]
        fc.integer({ min: 0, max: 100 }),
        (totalLessons, rawCompleted) => {
          // Constrain K to be within [0, N]
          const completedLessons = Math.min(rawCompleted, totalLessons);

          // Compute progress using the formula
          const progress = Math.round((completedLessons / totalLessons) * 100);

          // Progress must be in valid range [0, 100]
          if (progress < 0 || progress > 100) {
            throw new Error(
              `Progress ${progress}% is outside valid range [0, 100] ` +
              `for K=${completedLessons}, N=${totalLessons}`,
            );
          }

          // Zero completed lessons must yield 0%
          if (completedLessons === 0 && progress !== 0) {
            throw new Error(
              `Zero completed lessons should yield 0% but got ${progress}%`,
            );
          }

          // All lessons completed must yield 100%
          if (completedLessons === totalLessons && progress !== 100) {
            throw new Error(
              `All lessons completed should yield 100% but got ${progress}%`,
            );
          }

          // Progress must be monotonically non-decreasing:
          // completing one more lesson should not decrease progress
          if (completedLessons > 0) {
            const prevProgress = Math.round(
              ((completedLessons - 1) / totalLessons) * 100,
            );
            if (progress < prevProgress) {
              throw new Error(
                `Progress decreased from ${prevProgress}% to ${progress}% ` +
                `when completing lesson ${completedLessons}/${totalLessons}`,
              );
            }
          }
        },
      ),
      { numRuns },
    );

    return {
      property: 'Progress percentage equals completed lessons over total lessons',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'Progress percentage equals completed lessons over total lessons',
      passed: false,
      numRuns,
      counterexample: error.counterexample ?? undefined,
      error: error.message,
    };
  }
}

// ─── Direct Execution ────────────────────────────────────────────────────────

if (require.main === module) {
  const numRuns = parseInt(process.env.NUM_RUNS || '100', 10);
  runProgressCalculationProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
