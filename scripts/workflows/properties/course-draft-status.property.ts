/**
 * Property Test: Course creation always produces draft status
 *
 * For any valid course creation payload (with non-empty title, description,
 * and valid category ID), when submitted by an authorized instructor, the resulting
 * course SHALL appear in the course listing with status "draft".
 *
 * **Validates: Requirements 4.1**
 *
 * Testing framework: fast-check (property-based testing)
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
 * Generates random but valid titles, descriptions, and slugs.
 * Constraints:
 * - title: non-empty string (3-50 chars, alphanumeric + spaces)
 * - description: non-empty string (5-100 chars)
 * - slug: unique URL-safe identifier
 * - categoryId: one of the seeded category IDs
 */
function validCoursePayloadArbitrary(categoryIds: string[]) {
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
        fc.stringMatching(/^[a-z][a-z0-9]{2,12}$/),
        fc.nat({ max: 999999 }),
      )
      .map(([base, suffix]) => `${base}-pbt-draft-${suffix}-${Date.now()}`),
    categoryId:
      categoryIds.length > 0
        ? fc.constantFrom(...categoryIds)
        : fc.constant(undefined),
  });
}

// ─── Property Test ───────────────────────────────────────────────────────────

/**
 * Property 1: Course creation always produces draft status
 *
 * For any valid course creation payload (with non-empty title, description,
 * and valid category ID), when submitted by an authorized instructor, the
 * resulting course SHALL appear in the course listing with status "draft".
 *
 * @param numRuns - Number of property test iterations (default: 10)
 * @returns PropertyTestResult with pass/fail and any counterexamples
 */
export async function runCourseDraftStatusProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.instructor);
  const client = apiClient(token);
  const createdCourseIds: string[] = [];

  try {
    await fc.assert(
      fc.asyncProperty(
        validCoursePayloadArbitrary(seed.categories),
        async (payload) => {
          // Create the course with the generated payload
          const createRes = await client.post('/courses', {
            title: payload.title,
            slug: payload.slug,
            description: payload.description,
            categoryId: payload.categoryId,
          });

          // Course creation should succeed
          if (createRes.status !== 201 && createRes.status !== 200) {
            throw new Error(
              `Course creation failed with HTTP ${createRes.status}: ${JSON.stringify(createRes.data)}`,
            );
          }

          const courseId = createRes.data.id;
          createdCourseIds.push(courseId);

          // PROPERTY ASSERTION 1: Creation response has status "draft"
          const creationStatus = createRes.data.status;
          if (creationStatus !== 'draft') {
            throw new Error(
              `Expected creation response status "draft" but got "${creationStatus}" for course id=${courseId}`,
            );
          }

          // PROPERTY ASSERTION 2: Course appears in listing with status "draft"
          const listRes = await client.get('/courses');
          if (listRes.status !== 200) {
            throw new Error(
              `Course listing failed with HTTP ${listRes.status}`,
            );
          }

          const courses = Array.isArray(listRes.data)
            ? listRes.data
            : listRes.data?.data ?? listRes.data?.courses ?? [];

          const found = courses.find((c: any) => c.id === courseId);
          if (!found) {
            throw new Error(
              `Created course ${courseId} not found in course listing`,
            );
          }

          if (found.status !== 'draft') {
            throw new Error(
              `Course ${courseId} appears in listing with status "${found.status}" instead of "draft"`,
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
  console.log(`Running property test: Course creation always produces draft status (${numRuns} iterations)...`);
  runCourseDraftStatusProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
