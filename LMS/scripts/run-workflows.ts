/**
 * Workflow Test Runner
 *
 * Loads the validation seed result, then executes every API-level workflow test
 * sequentially (one failing workflow does not abort the rest). Collects the
 * WorkflowResult[] from all workflows, prints a readable pass/fail summary to
 * stdout, and writes the results to a JSON file for the report generator
 * (task 11.2) to consume.
 *
 * Order: lms → ai → ai-safety → enterprise → upload-storage → rbac →
 *        analytics-audit → persistence
 *
 * Requirements: 4.1–4.9, 5.1–5.4, 6.1–6.6, 7.1–7.4
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowResult, SeedResult } from './workflows/types.js';
import { runLmsWorkflow } from './workflows/lms-workflow.js';
import { runAiWorkflow } from './workflows/ai-workflow.js';
import { runAiSafetyWorkflow } from './workflows/ai-safety-workflow.js';
import { runEnterpriseWorkflow } from './workflows/enterprise-workflow.js';
import { runUploadStorageWorkflow } from './workflows/upload-storage-workflow.js';
import { runRbacWorkflow } from './workflows/rbac-workflow.js';
import { runAnalyticsAuditWorkflow } from './workflows/analytics-audit-workflow.js';
import { runPersistenceWorkflow } from './workflows/persistence-workflow.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

const SEED_RESULT_PATH = path.resolve(__dirname, '.validation-seed-result.json');
const WORKFLOW_RESULTS_PATH = path.resolve(
  __dirname,
  '.validation-workflow-results.json',
);

// ─── Seed Loading ─────────────────────────────────────────────────────────────

function loadSeedResult(): SeedResult {
  if (!fs.existsSync(SEED_RESULT_PATH)) {
    throw new Error(
      `Seed result file not found at ${SEED_RESULT_PATH}. Run \`validate:seed\` first.`,
    );
  }
  const raw = fs.readFileSync(SEED_RESULT_PATH, 'utf-8');
  return JSON.parse(raw) as SeedResult;
}

// ─── Workflow Registry ─────────────────────────────────────────────────────────

interface WorkflowEntry {
  name: string;
  run: (seed: SeedResult) => Promise<WorkflowResult>;
}

/**
 * Workflows are run sequentially in this exact order. The persistence workflow
 * is intentionally last because it may restart the compose stack.
 */
const WORKFLOWS: WorkflowEntry[] = [
  { name: 'LMS', run: (seed) => runLmsWorkflow(seed) },
  { name: 'AI', run: (seed) => runAiWorkflow(seed) },
  { name: 'AI Safety', run: (seed) => runAiSafetyWorkflow(seed) },
  { name: 'Enterprise', run: (seed) => runEnterpriseWorkflow(seed) },
  { name: 'Upload & Storage', run: (seed) => runUploadStorageWorkflow(seed) },
  { name: 'RBAC', run: (seed) => runRbacWorkflow(seed) },
  { name: 'Analytics & Audit', run: (seed) => runAnalyticsAuditWorkflow(seed) },
  { name: 'Persistence', run: (seed) => runPersistenceWorkflow(seed) },
];

// ─── Runner ────────────────────────────────────────────────────────────────────

/**
 * Executes all workflow tests sequentially and returns the collected results.
 * A thrown error from any single workflow is captured as a failed
 * WorkflowResult so that the remaining workflows still run.
 */
export async function runAllWorkflows(): Promise<WorkflowResult[]> {
  const seed = loadSeedResult();
  const results: WorkflowResult[] = [];

  for (const workflow of WORKFLOWS) {
    console.log(`\n▶ Running ${workflow.name} workflow...`);
    const start = Date.now();
    try {
      const result = await workflow.run(seed);
      results.push(result);
      console.log(
        `  ${result.passed ? '✓ PASS' : '✗ FAIL'} ${workflow.name} ` +
          `(${result.steps.filter((s) => s.passed).length}/${result.steps.length} steps, ${result.duration}ms)`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        name: workflow.name,
        steps: [],
        passed: false,
        duration: Date.now() - start,
        error: message,
      });
      console.log(`  ✗ FAIL ${workflow.name} (threw: ${message})`);
    }
  }

  return results;
}

// ─── Summary ───────────────────────────────────────────────────────────────────

function printSummary(results: WorkflowResult[]): void {
  console.log('\n' + '='.repeat(64));
  console.log('WORKFLOW VALIDATION SUMMARY');
  console.log('='.repeat(64));

  let totalSteps = 0;
  let totalPassedSteps = 0;
  let passedWorkflows = 0;

  for (const result of results) {
    const passedSteps = result.steps.filter((s) => s.passed).length;
    totalSteps += result.steps.length;
    totalPassedSteps += passedSteps;
    if (result.passed) passedWorkflows++;

    const status = result.passed ? 'PASS' : 'FAIL';
    const stepInfo = `${passedSteps}/${result.steps.length} steps`;
    console.log(
      `  [${status}] ${result.name.padEnd(20)} ${stepInfo.padEnd(14)} ${result.duration}ms`,
    );
    if (result.error) {
      console.log(`          error: ${result.error}`);
    }
    // List failing steps for quick triage.
    for (const step of result.steps) {
      if (!step.passed) {
        console.log(`          ✗ ${step.description}`);
      }
    }
  }

  console.log('-'.repeat(64));
  console.log(
    `  Workflows: ${passedWorkflows}/${results.length} passed | ` +
      `Steps: ${totalPassedSteps}/${totalSteps} passed`,
  );
  console.log('='.repeat(64) + '\n');
}

// ─── Persistence ───────────────────────────────────────────────────────────────

function writeResults(results: WorkflowResult[]): void {
  fs.writeFileSync(WORKFLOW_RESULTS_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Workflow results written to ${WORKFLOW_RESULTS_PATH}`);
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  runAllWorkflows()
    .then((results) => {
      printSummary(results);
      writeResults(results);
      const allPassed = results.every((r) => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Workflow runner failed:', message);
      process.exit(1);
    });
}
