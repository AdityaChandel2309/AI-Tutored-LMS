/**
 * Property Test: AI Tutor enrollment guard rejects unenrolled learners
 *
 * For any course and for any learner who does not have an active enrollment in
 * that course, sending a message to the AI Tutor for that course SHALL return
 * an enrollment-required error.
 *
 * **Validates: Requirements 5.2**
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
 * Runs the property test: AI Tutor enrollment guard rejects unenrolled learners.
 *
 * The seeded learner is not enrolled in the draft or review courses (those
 * courses are never published, so enrollment is impossible). This property
 * verifies that for any of those non-enrolled courses, and for any arbitrary
 * message string, sending a message to the AI Tutor SHALL be rejected with an
 * enrollment-required error (HTTP 403, or another 4xx whose message references
 * enrollment).
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runAiTutorEnrollmentGuardProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.learner);
  const client = apiClient(token);

  // Courses the learner is NOT enrolled in (non-published, so enrollment is impossible)
  const unenrolledCourses = [
    { id: seed.courses.draftId, status: 'draft' },
    { id: seed.courses.reviewId, status: 'review' },
  ];

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...unenrolledCourses),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (course, message) => {
          // Send a message to the AI Tutor for a course the learner is NOT enrolled in
          const chatRes = await client.post('/ai-tutor/chat', {
            message,
            courseId: course.id,
          });

          // The request MUST NOT succeed — an unenrolled learner cannot chat
          if (chatRes.status === 200 || chatRes.status === 201) {
            throw new Error(
              `Expected AI Tutor chat for unenrolled ${course.status} course (${course.id}) ` +
              `to be rejected, but got HTTP ${chatRes.status}: ${JSON.stringify(chatRes.data)}`,
            );
          }

          // A 403 Forbidden is the canonical enrollment-required error
          if (chatRes.status === 403) {
            return;
          }

          // Other 4xx responses are acceptable only if they reference enrollment
          if (chatRes.status >= 400 && chatRes.status < 500) {
            const errorMessage = (
              chatRes.data?.message ?? JSON.stringify(chatRes.data ?? '')
            )
              .toString()
              .toLowerCase();
            const mentionsEnrollment =
              errorMessage.includes('enroll') ||
              errorMessage.includes('enrollment');

            if (!mentionsEnrollment) {
              throw new Error(
                `Expected enrollment-required error for ${course.status} course (${course.id}), ` +
                `but got HTTP ${chatRes.status} without enrollment context: ${JSON.stringify(chatRes.data)}`,
              );
            }
            return;
          }

          // Any other status (e.g. 5xx) is a failure
          throw new Error(
            `Expected enrollment-required error (4xx) for ${course.status} course (${course.id}), ` +
            `but got HTTP ${chatRes.status}: ${JSON.stringify(chatRes.data)}`,
          );
        },
      ),
      { numRuns },
    );

    return {
      property: 'AI Tutor enrollment guard rejects unenrolled learners',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'AI Tutor enrollment guard rejects unenrolled learners',
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
  runAiTutorEnrollmentGuardProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
