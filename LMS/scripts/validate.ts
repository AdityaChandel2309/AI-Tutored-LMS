/**
 * Validation Orchestrator
 *
 * Top-level entry point for the LMS real-usage validation suite. Runs the four
 * validation phases in order and produces a friction report at the end:
 *
 *   1. Seed        — populate baseline data (tenant, users, courses, docs, ...)
 *   2. Deployment  — verify the Docker Compose stack is healthy
 *   3. Workflows   — exercise end-to-end API workflows against the live stack
 *   4. Report      — aggregate everything into docs/FRICTION_REPORT.md
 *
 * Each phase is wrapped so that a failure does NOT abort the remaining phases.
 * In particular the report generator always runs, even when earlier phases
 * fail, so that partial findings are still captured.
 *
 * Phase artifacts and the path reconciliation step:
 *   - The seed script (api/src/scripts/seed-validation.ts) is not exported, so
 *     it is executed as a child process via `npm run validate:seed`. It writes
 *     its SeedResult to the REPO ROOT at `<repo>/.validation-seed-result.json`.
 *     Downstream phases (workflow runner, workflow files, property tests) read
 *     the seed result from `<repo>/scripts/.validation-seed-result.json`. To
 *     reconcile this mismatch the orchestrator copies the repo-root file into
 *     the scripts/ directory after seeding.
 *   - The deployment result is persisted to
 *     `<repo>/scripts/.validation-deployment-result.json` so the report
 *     generator can consume it.
 *   - The workflow runner writes its own
 *     `<repo>/scripts/.validation-workflow-results.json`.
 *
 * Requirements: 2.1–2.8, 8.1–8.6
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { validateDeployment } from './validate-deployment.js';
import { runAllWorkflows } from './run-workflows.js';
import { generateReport } from './generate-report.js';
import { DeploymentResult, WorkflowResult } from './workflows/types.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

/** Repository root (parent of the scripts/ directory). */
const REPO_ROOT = path.resolve(__dirname, '..');
/** The api/ workspace, where the `validate:seed` npm script is registered. */
const API_DIR = path.resolve(__dirname, '..', 'api');
/** Where the seed script actually writes its result (repo root). */
const SEED_RESULT_SOURCE = path.resolve(__dirname, '..', '.validation-seed-result.json');
/** Where downstream phases expect the seed result (scripts/ directory). */
const SEED_RESULT_DEST = path.resolve(__dirname, '.validation-seed-result.json');
/** Where the deployment result is persisted for the report generator. */
const DEPLOYMENT_RESULT_PATH = path.resolve(
  __dirname,
  '.validation-deployment-result.json',
);

// ─── Phase Status Tracking ─────────────────────────────────────────────────────

type PhaseName = 'seed' | 'deploy' | 'workflows' | 'report';

interface PhaseStatus {
  name: PhaseName;
  passed: boolean;
  detail: string;
}

function recordPhase(
  statuses: Record<PhaseName, PhaseStatus>,
  name: PhaseName,
  passed: boolean,
  detail: string,
): void {
  statuses[name] = { name, passed, detail };
  const icon = passed ? '✓' : '✗';
  console.log(`\n${icon} Phase "${name}": ${passed ? 'OK' : 'FAILED'} — ${detail}\n`);
}

// ─── Phase 1: Seed ──────────────────────────────────────────────────────────────

/**
 * Runs the seed script as a child process (its `main()` is not exported), then
 * copies the repo-root seed result into the scripts/ directory so the workflow
 * phase can find it. The phase fails if the repo-root result is not produced.
 */
function runSeedPhase(statuses: Record<PhaseName, PhaseStatus>): void {
  console.log('═══════════════════════════════════════');
  console.log('  Phase 1/4: Seed');
  console.log('═══════════════════════════════════════');

  try {
    execSync('npm run validate:seed', {
      cwd: API_DIR,
      stdio: 'inherit',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  Seed child process reported an error: ${message}`);
    // Continue — the seed script may still have written a (partial) result.
  }

  if (!fs.existsSync(SEED_RESULT_SOURCE)) {
    recordPhase(
      statuses,
      'seed',
      false,
      `seed result not found at ${SEED_RESULT_SOURCE}`,
    );
    return;
  }

  // Reconcile the path mismatch: copy repo-root result → scripts/ directory.
  try {
    fs.copyFileSync(SEED_RESULT_SOURCE, SEED_RESULT_DEST);
    recordPhase(
      statuses,
      'seed',
      true,
      `seed result copied to ${SEED_RESULT_DEST}`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    recordPhase(statuses, 'seed', false, `failed to copy seed result: ${message}`);
  }
}

// ─── Phase 2: Deployment ────────────────────────────────────────────────────────

/**
 * Runs the deployment health checks and persists the result for the report
 * generator. A thrown error is recorded as a failure but does not abort the
 * remaining phases.
 */
async function runDeploymentPhase(
  statuses: Record<PhaseName, PhaseStatus>,
): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  Phase 2/4: Deployment Health Check');
  console.log('═══════════════════════════════════════');

  try {
    const result: DeploymentResult = await validateDeployment();

    // Persist the result so the report generator can consume it.
    try {
      fs.writeFileSync(
        DEPLOYMENT_RESULT_PATH,
        JSON.stringify(result, null, 2),
        'utf-8',
      );
      console.log(`  Deployment result written to ${DEPLOYMENT_RESULT_PATH}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  Could not persist deployment result: ${message}`);
    }

    recordPhase(
      statuses,
      'deploy',
      result.allHealthy,
      result.allHealthy
        ? 'all services healthy'
        : 'one or more service checks failed',
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    recordPhase(statuses, 'deploy', false, `deployment validation threw: ${message}`);
  }
}

// ─── Phase 3: Workflows ─────────────────────────────────────────────────────────

/**
 * Runs every API workflow test. Individual workflow failures are tolerated; the
 * phase passes only when every workflow passes, but it always continues to the
 * report phase regardless of outcome.
 */
async function runWorkflowsPhase(
  statuses: Record<PhaseName, PhaseStatus>,
): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  Phase 3/4: Workflow Tests');
  console.log('═══════════════════════════════════════');

  try {
    const results: WorkflowResult[] = await runAllWorkflows();
    const passedCount = results.filter((r) => r.passed).length;
    const total = results.length;
    const allPassed = total > 0 && passedCount === total;

    recordPhase(
      statuses,
      'workflows',
      allPassed,
      `${passedCount}/${total} workflows passed`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    recordPhase(statuses, 'workflows', false, `workflow runner threw: ${message}`);
  }
}

// ─── Phase 4: Report ────────────────────────────────────────────────────────────

/**
 * Always generates the friction report from whatever artifacts are available.
 * Runs even when earlier phases failed.
 */
async function runReportPhase(
  statuses: Record<PhaseName, PhaseStatus>,
): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  Phase 4/4: Report Generation');
  console.log('═══════════════════════════════════════');

  try {
    await generateReport();
    recordPhase(statuses, 'report', true, 'friction report generated');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    recordPhase(statuses, 'report', false, `report generation threw: ${message}`);
  }
}

// ─── Overall Summary ─────────────────────────────────────────────────────────────

function printSummary(statuses: Record<PhaseName, PhaseStatus>): boolean {
  const order: PhaseName[] = ['seed', 'deploy', 'workflows', 'report'];

  console.log('\n' + '='.repeat(48));
  console.log('  VALIDATION SUMMARY');
  console.log('='.repeat(48));

  let allPassed = true;
  for (const name of order) {
    const status = statuses[name];
    const icon = status.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  [${icon}] ${name.padEnd(10)} ${status.detail}`);
    if (!status.passed) {
      allPassed = false;
    }
  }

  console.log('-'.repeat(48));
  console.log(`  Overall: ${allPassed ? '✓ ALL PHASES PASSED' : '✗ ONE OR MORE PHASES FAILED'}`);
  console.log('='.repeat(48) + '\n');

  return allPassed;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * Runs all validation phases in order, tolerating per-phase failures so that
 * the report is always produced, and prints an overall summary at the end.
 */
export async function runValidation(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║      LMS Real Usage Validation Suite           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`Repository root: ${REPO_ROOT}`);
  console.log(`API directory:   ${API_DIR}\n`);

  const statuses: Record<PhaseName, PhaseStatus> = {
    seed: { name: 'seed', passed: false, detail: 'not run' },
    deploy: { name: 'deploy', passed: false, detail: 'not run' },
    workflows: { name: 'workflows', passed: false, detail: 'not run' },
    report: { name: 'report', passed: false, detail: 'not run' },
  };

  // Phase 1: Seed (child process + path reconciliation).
  runSeedPhase(statuses);

  // Phase 2: Deployment health checks.
  await runDeploymentPhase(statuses);

  // Phase 3: Workflow tests (continue even if some/all fail).
  await runWorkflowsPhase(statuses);

  // Phase 4: Report generation (always runs).
  await runReportPhase(statuses);

  const allPassed = printSummary(statuses);

  // Exit 0 only when every phase succeeded.
  process.exitCode = allPassed ? 0 : 1;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  runValidation().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Validation orchestrator failed:', message);
    process.exit(1);
  });
}
