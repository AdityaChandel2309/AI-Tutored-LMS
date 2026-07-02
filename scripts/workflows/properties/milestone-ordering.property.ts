/**
 * Property Test: Milestone ordering is preserved on retrieval
 *
 * For any project with milestones created with explicit order values,
 * retrieving the project's milestones SHALL return them sorted by their
 * order field in ascending sequence.
 *
 * **Validates: Requirements 6.4**
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
 * Runs the property test: milestone ordering is preserved on retrieval.
 *
 * For a fast-check-generated array of distinct order values (shuffled), this
 * test creates a project, adds milestones with those order values in shuffled
 * insertion order, retrieves the project, and asserts the returned milestones
 * are sorted ascending by their order field. Created projects are cleaned up
 * on a best-effort basis.
 *
 * @param numRuns - Number of iterations to run (default: 10)
 * @returns PropertyTestResult indicating pass/fail with any counterexamples
 */
export async function runMilestoneOrderingProperty(
  numRuns = 10,
): Promise<PropertyTestResult> {
  const seed = loadSeedResult();
  const token = await getToken(seed.users.admin);
  const client = apiClient(token);

  const propertyName = 'Milestone ordering is preserved on retrieval';

  try {
    await fc.assert(
      fc.asyncProperty(
        // Generate a non-empty array of distinct order values, then shuffle it so
        // milestones are inserted in an arbitrary (out-of-natural) order.
        fc
          .uniqueArray(fc.integer({ min: 1, max: 10000 }), {
            minLength: 2,
            maxLength: 8,
          })
          .chain((orders) => fc.shuffledSubarray(orders, { minLength: orders.length })),
        async (shuffledOrders) => {
          let projectId: string | undefined;

          try {
            // Create a project
            const createRes = await client.post('/projects', {
              title: 'Milestone Ordering Property Test',
              description: 'Created by milestone-ordering property test',
              startDate: new Date().toISOString(),
              targetEndDate: new Date(
                Date.now() + 90 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            });

            if (createRes.status !== 201 && createRes.status !== 200) {
              throw new Error(
                `Expected HTTP 200/201 on project creation, but got HTTP ${createRes.status}: ` +
                  `${JSON.stringify(createRes.data)}`,
              );
            }

            projectId = createRes.data.id;

            if (!projectId) {
              throw new Error(
                `Expected created project to have an id, but got: ${JSON.stringify(createRes.data)}`,
              );
            }

            // Add milestones with the generated order values, in shuffled insertion order.
            for (const order of shuffledOrders) {
              const msRes = await client.post(`/projects/${projectId}/milestones`, {
                title: `Milestone ${order}`,
                description: `Milestone with order ${order}`,
                order,
              });

              if (msRes.status !== 201 && msRes.status !== 200) {
                throw new Error(
                  `Expected HTTP 200/201 on milestone creation (order ${order}), but got ` +
                    `HTTP ${msRes.status}: ${JSON.stringify(msRes.data)}`,
                );
              }
            }

            // Retrieve the project and inspect the returned milestones.
            const getRes = await client.get(`/projects/${projectId}`);

            if (getRes.status !== 200) {
              throw new Error(
                `Expected HTTP 200 on project retrieval, but got HTTP ${getRes.status}: ` +
                  `${JSON.stringify(getRes.data)}`,
              );
            }

            const retrievedMilestones: { order: number }[] =
              getRes.data.milestones ?? [];

            if (retrievedMilestones.length !== shuffledOrders.length) {
              throw new Error(
                `Expected ${shuffledOrders.length} milestones to be retrieved, but got ` +
                  `${retrievedMilestones.length}`,
              );
            }

            // The returned milestones MUST be sorted ascending by their order field.
            const orders = retrievedMilestones.map((m) => m.order);
            const isSorted = orders.every(
              (val, i) => i === 0 || val >= orders[i - 1],
            );

            if (!isSorted) {
              throw new Error(
                `Expected retrieved milestones to be sorted ascending by order, but got ` +
                  `[${orders.join(', ')}] (inserted: [${shuffledOrders.join(', ')}])`,
              );
            }
          } finally {
            // Best-effort cleanup: delete the created project. Ignore failures.
            if (projectId) {
              try {
                await client.delete(`/projects/${projectId}`);
              } catch {
                // ignore cleanup failures
              }
            }
          }
        },
      ),
      { numRuns },
    );

    return {
      property: propertyName,
      passed: true,
      numRuns,
    };
  } catch (err: unknown) {
    const error = err as Error & { counterexample?: unknown };
    return {
      property: propertyName,
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
  runMilestoneOrderingProperty(numRuns)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}
