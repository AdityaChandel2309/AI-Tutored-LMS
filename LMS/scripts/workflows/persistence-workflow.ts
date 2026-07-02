/**
 * Data Persistence Workflow Test
 *
 * Validates that data survives a Docker Compose stop/restart cycle:
 * - Seeded postgres records remain retrievable after restart
 * - Uploaded minio objects remain accessible after restart
 * - Keycloak users can still authenticate after restart
 *
 * Requirements: 3.1–3.3
 *
 * ─── OPERATOR PROCEDURE (REQUIRED) ───────────────────────────────────────────
 * This workflow inherently requires a Compose restart that CANNOT be performed
 * inline by this script (it would tear down the very process running the test).
 * The intended manual procedure is:
 *
 *   1. Run the seed script:        npm run validate:seed
 *   2. Restart the stack:          docker compose down && docker compose up -d
 *   3. Wait for services healthy:  npm run validate:deploy
 *   4. Run this workflow:          npm run validate:workflows  (or in isolation)
 *
 * This test therefore verifies the CURRENT post-restart state of the stack: it
 * confirms that the records created by the seed step are still present in
 * postgres (via the API), that uploaded objects in minio are still downloadable,
 * and that Keycloak authentication still succeeds. It does NOT invoke any docker
 * commands itself — the operator must perform the restart between seeding and
 * running this test for the persistence assertion to be meaningful.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { WorkflowResult, StepResult, SeedResult } from './types.js';
import { getToken, apiClient } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSeedResult(): SeedResult {
  const seedPath = path.resolve(__dirname, '../.validation-seed-result.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

async function runStep(
  description: string,
  fn: () => Promise<{ passed: boolean; expected?: string; actual?: string }>,
): Promise<StepResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      description,
      passed: result.passed,
      expected: result.expected,
      actual: result.actual,
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      description,
      passed: false,
      expected: 'No error thrown',
      actual: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

// ─── Workflow Steps ──────────────────────────────────────────────────────────

/**
 * Step 1: Seeded postgres records remain after compose restart
 * Validates: Requirement 3.1
 *
 * Confirms that the records created by the seed script (tenant, courses,
 * departments, designations) are still retrievable via the API after the
 * operator has restarted the Compose stack.
 */
async function testSeededRecordsPersist(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Seeded postgres records remain retrievable after compose restart',
    async () => {
      const token = await getToken(seed.users.admin);
      const client = apiClient(token);

      const missing: string[] = [];
      const found: string[] = [];

      // Verify the seeded published course still exists
      if (seed.courses.publishedId) {
        const courseRes = await client.get(`/courses/${seed.courses.publishedId}`);
        if (courseRes.status === 200 && courseRes.data?.id === seed.courses.publishedId) {
          found.push(`course ${seed.courses.publishedId}`);
        } else {
          missing.push(
            `published course ${seed.courses.publishedId} (HTTP ${courseRes.status})`,
          );
        }
      }

      // Verify the seeded parent department still exists (appears in listing)
      if (seed.departments.parentId) {
        const deptRes = await client.get(`/departments/${seed.departments.parentId}`);
        if (deptRes.status === 200 && deptRes.data?.id === seed.departments.parentId) {
          found.push(`department ${seed.departments.parentId}`);
        } else {
          missing.push(
            `parent department ${seed.departments.parentId} (HTTP ${deptRes.status})`,
          );
        }
      }

      // Verify the seeded senior designation still exists (appears in listing)
      if (seed.designations.seniorId) {
        const listRes = await client.get('/designations');
        const designations = Array.isArray(listRes.data)
          ? listRes.data
          : listRes.data?.data ?? [];
        const exists = designations.some(
          (d: { id: string }) => d.id === seed.designations.seniorId,
        );
        if (listRes.status === 200 && exists) {
          found.push(`designation ${seed.designations.seniorId}`);
        } else {
          missing.push(
            `senior designation ${seed.designations.seniorId} (HTTP ${listRes.status}, found=${exists})`,
          );
        }
      }

      if (missing.length > 0) {
        return {
          passed: false,
          expected: 'All seeded records retrievable after restart',
          actual: `Missing records: ${missing.join('; ')}`,
        };
      }

      return {
        passed: true,
        expected: 'All seeded postgres records persist across restart',
        actual: `Verified persisted records: ${found.join(', ')}`,
      };
    },
  );
}

/**
 * Step 2: Uploaded minio objects remain accessible after restart
 * Validates: Requirement 3.2
 *
 * Confirms that a document uploaded to minio (seeded) still has its metadata
 * stored and that its object is retrievable via the presigned download URL.
 */
async function testUploadedObjectsAccessible(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Uploaded minio objects remain accessible after compose restart',
    async () => {
      const token = await getToken(seed.users.admin);
      const client = apiClient(token);

      const documentId = seed.documents?.[0];

      if (!documentId) {
        return {
          passed: false,
          expected: 'At least one seeded document ID available from seed result',
          actual: `seed.documents = ${JSON.stringify(seed.documents)}`,
        };
      }

      // Verify the document metadata is still stored in postgres
      const getRes = await client.get(`/documents/${documentId}`);
      if (getRes.status !== 200 || getRes.data?.id !== documentId) {
        return {
          passed: false,
          expected: 'HTTP 200 with persisted document metadata',
          actual: `HTTP ${getRes.status}: ${JSON.stringify(getRes.data)}`,
        };
      }

      // Request a presigned download URL for the underlying minio object
      const downloadRes = await client.get(`/documents/${documentId}/download`);
      if (downloadRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on document download URL retrieval',
          actual: `HTTP ${downloadRes.status}: ${JSON.stringify(downloadRes.data)}`,
        };
      }

      const downloadUrl = downloadRes.data?.url || downloadRes.data?.downloadUrl;
      if (!downloadUrl || typeof downloadUrl !== 'string') {
        return {
          passed: false,
          expected: 'Download response contains a presigned URL string',
          actual: `Download response: ${JSON.stringify(downloadRes.data)}`,
        };
      }

      // Verify the minio object is actually fetchable via the presigned URL.
      // A HEAD request confirms the object still exists in the bucket after restart.
      const objectRes = await axios.head(downloadUrl, { validateStatus: () => true });
      if (objectRes.status < 200 || objectRes.status >= 300) {
        return {
          passed: false,
          expected: 'Presigned URL returns HTTP 2xx (object present in minio)',
          actual: `HTTP ${objectRes.status} when fetching object from minio`,
        };
      }

      return {
        passed: true,
        expected: 'Uploaded minio object accessible via presigned URL after restart',
        actual: `Document ${documentId} metadata persisted and object fetchable (HTTP ${objectRes.status})`,
      };
    },
  );
}

/**
 * Step 3: Keycloak user can still authenticate after restart
 * Validates: Requirement 3.3
 *
 * Confirms that seeded users provisioned in Keycloak can still obtain access
 * tokens (password grant) after the Compose stack restart, and that those
 * tokens authorize an authenticated API call.
 */
async function testKeycloakAuthPersists(seed: SeedResult): Promise<StepResult> {
  return runStep(
    'Keycloak users can still authenticate after compose restart',
    async () => {
      const candidates = [
        { label: 'admin', user: seed.users.admin },
        { label: 'instructor', user: seed.users.instructor },
        { label: 'learner', user: seed.users.learner },
      ];

      const authenticated: string[] = [];
      const failed: string[] = [];

      for (const { label, user } of candidates) {
        if (!user) continue;
        try {
          const token = await getToken(user);
          if (!token || typeof token !== 'string') {
            failed.push(`${label} (empty token)`);
            continue;
          }

          // Verify the token actually authorizes an authenticated request
          const client = apiClient(token);
          const meRes = await client.get('/auth/me');
          if (meRes.status >= 200 && meRes.status < 300) {
            authenticated.push(label);
          } else {
            failed.push(`${label} (token rejected, HTTP ${meRes.status})`);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          failed.push(`${label} (${message})`);
        }
      }

      if (authenticated.length === 0) {
        return {
          passed: false,
          expected: 'At least one seeded Keycloak user authenticates after restart',
          actual: `No users authenticated. Failures: ${failed.join('; ')}`,
        };
      }

      if (failed.length > 0) {
        return {
          passed: false,
          expected: 'All seeded Keycloak users authenticate after restart',
          actual: `Authenticated: [${authenticated.join(', ')}]; Failed: [${failed.join('; ')}]`,
        };
      }

      return {
        passed: true,
        expected: 'Seeded Keycloak users authenticate after restart',
        actual: `Authenticated users: ${authenticated.join(', ')}`,
      };
    },
  );
}

// ─── Workflow Entry Point ────────────────────────────────────────────────────

export async function runPersistenceWorkflow(
  seedResult?: SeedResult,
): Promise<WorkflowResult> {
  const start = Date.now();
  const seed = seedResult ?? loadSeedResult();
  const steps: StepResult[] = [];

  steps.push(await testSeededRecordsPersist(seed));
  steps.push(await testUploadedObjectsAccessible(seed));
  steps.push(await testKeycloakAuthPersists(seed));

  const passed = steps.every((s) => s.passed);

  return {
    name: 'Data Persistence Workflow',
    steps,
    passed,
    duration: Date.now() - start,
  };
}
