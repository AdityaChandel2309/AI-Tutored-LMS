/**
 * Property Test: Course creation always produces draft status
 *
 * For any valid course creation payload (with non-empty title, description,
 * and valid category ID), when submitted by an authorized instructor, the resulting
 * course SHALL appear with status "draft".
 *
 * **Validates: Requirements 4.1**
 */

import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';
import { SeedResult } from '../types';
import { getToken, apiClient } from '../helpers';

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
  if (!fs.existsSync(seedPath)) {
    throw new Error(
      `Seed result file not found at ${seedPath}. Run validate:seed first.`,
    );
  }
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

/**
 * Arbitrary for generating valid course creation payloads.
 * Generates random but valid titles, descriptions, and slugs that satisfy API constraints.
 */
function coursePayloadArbitrary(categoryIds: string[]) {
  return fc.record({
    title: fc
      .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,49}$/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3),
    description: fc
      .stringMatching(/^[A-Za-z][A-Za-z0-9 .,!?]{4,99}$/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 5),
    slug: fc
      .tuple(
        fc.stringMatching(/^[a-z][a-z0-9]{2,15}$/),
        fc.nat({ max: 999999 }),
      )
      .map(([base, suffix]) => `${base}-pbt-${suffix}-${Date.now()}`),
    categoryId:
      categoryIds.length > 0
        ? fc.constantFrom(...categoryIds)
        : fc.constant(undefined),
  });
}

// ─── Property Test Runner ────────────────────────────────────────────────────

/**
 * Runs the property test: course creation always produces draft status.
 *
 * For any valid course creation payload, when submitted by an authorized instructor,
 * the resulting course SHALL have status "draft" both in the creation response
 * and when retrieved via GET.
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runCourseCreationDraftProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.instructor);
  const client = apiClient(token);
  const createdCourseIds: string[] = [];

  try {
    await fc.assert(
      fc.asyncProperty(
        coursePayloadArbitrary(seed.categories),
        async (payload) => {
          // Create the course with the generated payload
          const createRes = await client.post('/courses', {
            title: payload.title,
            slug: payload.slug,
            description: payload.description,
            categoryId: payload.categoryId,
          });

          // Course creation should succeed (200 or 201)
          if (createRes.status !== 201 && createRes.status !== 200) {
            throw new Error(
              `Course creation failed with HTTP ${createRes.status}: ${JSON.stringify(createRes.data)}`,
            );
          }

          const courseId = createRes.data.id;
          createdCourseIds.push(courseId);

          // PROPERTY: The created course MUST have status "draft"
          const status = createRes.data.status;
          if (status !== 'draft') {
            throw new Error(
              `Expected status "draft" but got "${status}" for course id=${courseId}`,
            );
          }

          // Double-check: verify via GET that the course is persisted with draft status
          const getRes = await client.get(`/courses/${courseId}`);
          if (getRes.status !== 200) {
            throw new Error(
              `Failed to retrieve course ${courseId}: HTTP ${getRes.status}`,
            );
          }

          const retrievedStatus = getRes.data.status;
          if (retrievedStatus !== 'draft') {
            throw new Error(
              `Course ${courseId} retrieved with status "${retrievedStatus}" instead of "draft"`,
            );
          }
        },
      ),
      { numRuns, verbose: true },
    );

    return {
      property: 'Course creation always produces draft status',
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: 'Course creation always produces draft status',
      passed: false,
      numRuns,
      counterexample: error.counterexample ?? undefined,
      error: error.message,
    };
  } finally {
    // Clean up: delete all courses created during the test
    for (const courseId of createdCourseIds) {
      try {
        await client.delete(`/courses/${courseId}`);
      } catch {
        // Best-effort cleanup; ignore failures
      }
    }
  }
}

// ─── Direct Execution ────────────────────────────────────────────────────────

if (require.main === module) {
  const numRuns = parseInt(process.env.NUM_RUNS || '10', 10);
  runCourseCreationDraftProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
