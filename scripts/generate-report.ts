/**
 * Friction Report Generator
 *
 * Aggregates the deployment validation result and the workflow test results
 * (both persisted as JSON by earlier validation phases) into a single,
 * human-readable markdown report at `docs/FRICTION_REPORT.md`.
 *
 * The report contains:
 *   - Environment metadata (compose version, node version, platform, timestamp)
 *   - Deployment health summary
 *   - Passed workflows
 *   - Bugs grouped by severity (critical / major / minor) with reproduction
 *     steps and expected-vs-actual behaviour
 *   - UX / operational friction points
 *   - A Production Readiness Summary with four 0–100 scores, a production
 *     blockers list, and a prioritized list of recommended next actions
 *
 * Scoring is derived from the pass rate of related workflow steps and
 * deployment checks — it is data-driven, not subjective.
 *
 * Inputs (read from sibling JSON files, degrade gracefully if missing):
 *   - scripts/.validation-workflow-results.json   (WorkflowResult[])
 *   - scripts/.validation-deployment-result.json  (DeploymentResult)
 *
 * Output:
 *   - docs/FRICTION_REPORT.md
 *
 * Requirements: 8.1–8.6
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  WorkflowResult,
  StepResult,
  DeploymentResult,
  DeploymentCheck,
  Bug,
  FrictionPoint,
  FrictionReport,
  ProductionReadiness,
} from './workflows/types.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

const WORKFLOW_RESULTS_PATH = path.resolve(
  __dirname,
  '.validation-workflow-results.json',
);
const DEPLOYMENT_RESULT_PATH = path.resolve(
  __dirname,
  '.validation-deployment-result.json',
);
const REPORT_PATH = path.resolve(__dirname, '..', 'docs', 'FRICTION_REPORT.md');

// ─── Input Loading (graceful degradation) ─────────────────────────────────────

interface LoadedInputs {
  workflowResults: WorkflowResult[];
  deployment: DeploymentResult | null;
  missing: string[];
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Failed to parse ${filePath}: ${message}`);
    return null;
  }
}

function loadInputs(): LoadedInputs {
  const missing: string[] = [];

  const workflowResults = readJsonFile<WorkflowResult[]>(WORKFLOW_RESULTS_PATH);
  if (!workflowResults) {
    missing.push(
      'workflow results (scripts/.validation-workflow-results.json)',
    );
  }

  const deployment = readJsonFile<DeploymentResult>(DEPLOYMENT_RESULT_PATH);
  if (!deployment) {
    missing.push(
      'deployment results (scripts/.validation-deployment-result.json)',
    );
  }

  return {
    workflowResults: Array.isArray(workflowResults) ? workflowResults : [],
    deployment: deployment ?? null,
    missing,
  };
}

// ─── Environment Metadata ──────────────────────────────────────────────────────

function getComposeVersion(): string {
  try {
    return execSync('docker compose version', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: 'pipe',
    })
      .trim()
      .split('\n')[0]
      .trim();
  } catch {
    return 'unknown';
  }
}

function getEnvironment(): FrictionReport['environment'] {
  return {
    composeVersion: getComposeVersion(),
    nodeVersion: process.version,
    platform: process.platform,
  };
}

// ─── Workflow Step Helpers ─────────────────────────────────────────────────────

/** Normalize a name for tolerant matching (lowercase, strip non-alphanumerics). */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Find a workflow whose name loosely matches any of the provided aliases.
 * Tolerant of naming variations like "Analytics & Audit" vs "Analytics and Audit".
 */
function findWorkflow(
  results: WorkflowResult[],
  aliases: string[],
): WorkflowResult | undefined {
  const normalizedAliases = aliases.map(normalize);
  return results.find((w) => {
    const n = normalize(w.name);
    return normalizedAliases.some(
      (alias) => n === alias || n.includes(alias) || alias.includes(n),
    );
  });
}

function stepMatches(step: StepResult, keywords: string[]): boolean {
  const haystack = normalize(
    `${step.description} ${step.expected ?? ''} ${step.actual ?? ''}`,
  );
  return keywords.some((kw) => haystack.includes(normalize(kw)));
}

interface PassRate {
  passed: number;
  total: number;
}

function ratioOf(steps: StepResult[]): PassRate {
  return {
    passed: steps.filter((s) => s.passed).length,
    total: steps.length,
  };
}

function combine(...rates: PassRate[]): PassRate {
  return rates.reduce(
    (acc, r) => ({ passed: acc.passed + r.passed, total: acc.total + r.total }),
    { passed: 0, total: 0 },
  );
}

/** Round a pass rate into a 0–100 score. Returns null when there is no data. */
function scoreOf(rate: PassRate): number | null {
  if (rate.total === 0) return null;
  return Math.round((rate.passed / rate.total) * 100);
}

// ─── Bug Extraction ─────────────────────────────────────────────────────────────

const SECURITY_KEYWORDS = [
  'rbac',
  '403',
  '401',
  'forbidden',
  'unauthorized',
  'unauthenticated',
  'unauthorised',
  'auth',
  'tenant',
  'isolation',
  'cross-tenant',
  'permission',
  'access',
];

const NOT_IMPLEMENTED_KEYWORDS = [
  '404',
  'not found',
  'not implemented',
  'unimplemented',
  'endpoint does not exist',
  'no such endpoint',
];

/**
 * Severity heuristic for a failed step:
 *   - 404 / unimplemented-endpoint findings → minor
 *   - auth / security / tenant-isolation failures → critical
 *   - everything else → major
 */
function classifyStepSeverity(
  workflowName: string,
  step: StepResult,
): Bug['severity'] {
  if (stepMatches(step, NOT_IMPLEMENTED_KEYWORDS)) {
    return 'minor';
  }
  const isSecurityWorkflow = ['rbac'].includes(normalize(workflowName));
  if (isSecurityWorkflow || stepMatches(step, SECURITY_KEYWORDS)) {
    return 'critical';
  }
  return 'major';
}

function extractBugs(results: WorkflowResult[]): Bug[] {
  const bugs: Bug[] = [];
  let counter = 1;

  for (const workflow of results) {
    // A workflow that threw before/while running its steps is a critical bug:
    // the flow is completely broken.
    if (workflow.error) {
      bugs.push({
        id: `BUG-${String(counter++).padStart(3, '0')}`,
        severity: 'critical',
        workflow: workflow.name,
        description: `The "${workflow.name}" workflow threw an error and could not complete.`,
        reproductionSteps: [`Run the ${workflow.name} workflow against the live stack.`],
        expected: 'Workflow runs to completion without throwing.',
        actual: workflow.error,
      });
    }

    for (const step of workflow.steps) {
      if (step.passed) continue;
      bugs.push({
        id: `BUG-${String(counter++).padStart(3, '0')}`,
        severity: classifyStepSeverity(workflow.name, step),
        workflow: workflow.name,
        description: step.description,
        reproductionSteps: [step.description],
        expected: step.expected ?? 'Step passes.',
        actual: step.actual ?? 'Step failed (no detail captured).',
      });
    }
  }

  return bugs;
}

// ─── Friction Point Extraction ──────────────────────────────────────────────────

/**
 * Derive operational friction points from deployment checks that reported a
 * "warn" status. Manual UX friction points are recorded separately by the
 * reviewer using the manual UI checklist.
 */
function extractFrictionPoints(deployment: DeploymentResult | null): FrictionPoint[] {
  if (!deployment) return [];
  const points: FrictionPoint[] = [];
  let counter = 1;

  for (const check of deployment.checks) {
    if (check.status === 'warn') {
      points.push({
        id: `FP-${String(counter++).padStart(3, '0')}`,
        area: check.service,
        description: `${check.check}: ${check.detail ?? 'reported a warning'}`,
        suggestedImprovement:
          'Investigate the warning and confirm the service is configured as expected.',
      });
    }
  }

  return points;
}

// ─── Production Readiness Scoring ────────────────────────────────────────────────

interface ScoreDetail {
  score: number | null;
  rate: PassRate;
  note?: string;
}

function deploymentRate(deployment: DeploymentResult | null): PassRate {
  if (!deployment) return { passed: 0, total: 0 };
  // A "warn" still means the service is reachable/healthy enough to boot, so it
  // counts toward deployment confidence; only hard failures detract.
  const total = deployment.checks.length;
  const passed = deployment.checks.filter(
    (c: DeploymentCheck) => c.status === 'pass' || c.status === 'warn',
  ).length;
  return { passed, total };
}

function computeReadiness(
  results: WorkflowResult[],
  deployment: DeploymentResult | null,
): { readiness: ProductionReadiness; details: Record<string, ScoreDetail> } {
  const notes: string[] = [];

  // Deployment confidence: deployment health checks + persistence workflow steps.
  const persistence = findWorkflow(results, ['Persistence']);
  const deployConfRate = combine(
    deploymentRate(deployment),
    persistence ? ratioOf(persistence.steps) : { passed: 0, total: 0 },
  );

  // Operational maturity: Analytics & Audit workflow step pass rate.
  const analytics = findWorkflow(results, ['Analytics & Audit', 'Analytics and Audit']);
  const opsRate = analytics ? ratioOf(analytics.steps) : { passed: 0, total: 0 };

  // AI safety readiness: AI Safety workflow step pass rate.
  const aiSafety = findWorkflow(results, ['AI Safety', 'AI Safety Validation']);
  const aiSafetyRate = aiSafety ? ratioOf(aiSafety.steps) : { passed: 0, total: 0 };

  // Security readiness: RBAC workflow + tenant-isolation related steps (any
  // workflow) + upload MIME enforcement steps.
  const rbac = findWorkflow(results, ['RBAC', 'RBAC Enforcement']);
  const tenantIsolationSteps: StepResult[] = [];
  const mimeSteps: StepResult[] = [];
  for (const workflow of results) {
    // Skip RBAC here so its steps are not double-counted.
    const isRbac = rbac && workflow.name === rbac.name;
    for (const step of workflow.steps) {
      if (!isRbac && stepMatches(step, ['tenant isolation', 'cross-tenant', 'isolation'])) {
        tenantIsolationSteps.push(step);
      }
      if (stepMatches(step, ['mime', 'disallowed type', 'upload', '.exe'])) {
        // Only count enforcement/restriction-oriented upload steps.
        if (stepMatches(step, ['mime', 'disallowed', 'reject', '.exe'])) {
          mimeSteps.push(step);
        }
      }
    }
  }
  const securityRate = combine(
    rbac ? ratioOf(rbac.steps) : { passed: 0, total: 0 },
    ratioOf(tenantIsolationSteps),
    ratioOf(mimeSteps),
  );

  const buildScore = (rate: PassRate, label: string): ScoreDetail => {
    const score = scoreOf(rate);
    if (score === null) {
      notes.push(`${label}: no related test steps were available (defaulted to 0).`);
      return { score: 0, rate, note: 'no related test data — defaulted to 0' };
    }
    return { score, rate };
  };

  const deploymentConfidence = buildScore(deployConfRate, 'Deployment confidence');
  const operationalMaturity = buildScore(opsRate, 'Operational maturity');
  const aiSafetyReadiness = buildScore(aiSafetyRate, 'AI safety readiness');
  const securityReadiness = buildScore(securityRate, 'Security readiness');

  const bugs = extractBugs(results);
  const productionBlockers = bugs
    .filter((b) => b.severity === 'critical' || b.severity === 'major')
    .map((b) => `[${b.severity.toUpperCase()}] (${b.workflow}) ${b.description}`);

  const recommendedNextActions = buildRecommendations(
    bugs,
    {
      deploymentConfidence: deploymentConfidence.score ?? 0,
      operationalMaturity: operationalMaturity.score ?? 0,
      aiSafetyReadiness: aiSafetyReadiness.score ?? 0,
      securityReadiness: securityReadiness.score ?? 0,
    },
    notes,
  );

  const readiness: ProductionReadiness = {
    deploymentConfidence: deploymentConfidence.score ?? 0,
    operationalMaturity: operationalMaturity.score ?? 0,
    aiSafetyReadiness: aiSafetyReadiness.score ?? 0,
    securityReadiness: securityReadiness.score ?? 0,
    productionBlockers,
    recommendedNextActions,
  };

  return {
    readiness,
    details: {
      deploymentConfidence,
      operationalMaturity,
      aiSafetyReadiness,
      securityReadiness,
    },
  };
}

function buildRecommendations(
  bugs: Bug[],
  scores: {
    deploymentConfidence: number;
    operationalMaturity: number;
    aiSafetyReadiness: number;
    securityReadiness: number;
  },
  notes: string[],
): string[] {
  const actions: string[] = [];

  // 1. Critical bugs first — these block deployment.
  for (const bug of bugs.filter((b) => b.severity === 'critical')) {
    actions.push(`Resolve CRITICAL issue in ${bug.workflow}: ${bug.description}`);
  }
  // 2. Major bugs next.
  for (const bug of bugs.filter((b) => b.severity === 'major')) {
    actions.push(`Address MAJOR issue in ${bug.workflow}: ${bug.description}`);
  }
  // 3. Score-driven recommendations for areas below an acceptable threshold.
  const THRESHOLD = 80;
  if (scores.securityReadiness < THRESHOLD) {
    actions.push(
      `Improve security readiness (currently ${scores.securityReadiness}/100): review RBAC enforcement, tenant isolation, and upload restrictions.`,
    );
  }
  if (scores.aiSafetyReadiness < THRESHOLD) {
    actions.push(
      `Improve AI safety readiness (currently ${scores.aiSafetyReadiness}/100): harden prompt-injection resistance, hallucination handling, and access boundaries.`,
    );
  }
  if (scores.deploymentConfidence < THRESHOLD) {
    actions.push(
      `Improve deployment confidence (currently ${scores.deploymentConfidence}/100): fix failing health checks and confirm data persistence across restarts.`,
    );
  }
  if (scores.operationalMaturity < THRESHOLD) {
    actions.push(
      `Improve operational maturity (currently ${scores.operationalMaturity}/100): strengthen audit logging coverage and analytics correctness.`,
    );
  }
  // 4. Minor bugs grouped at the end.
  const minorCount = bugs.filter((b) => b.severity === 'minor').length;
  if (minorCount > 0) {
    actions.push(
      `Implement or stub the ${minorCount} unimplemented/minor endpoint(s) flagged as minor findings.`,
    );
  }
  // 5. Note any data gaps that affected scoring.
  for (const note of notes) {
    actions.push(`Note: ${note}`);
  }

  if (actions.length === 0) {
    actions.push('No blocking issues found. Proceed with standard pre-deploy checks.');
  }

  return actions;
}

// ─── Markdown Rendering ──────────────────────────────────────────────────────────

function severityEmoji(severity: Bug['severity']): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'major':
      return '🟠';
    case 'minor':
      return '🟡';
  }
}

function statusIcon(status: DeploymentCheck['status']): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'warn':
      return '⚠️';
    case 'fail':
      return '❌';
  }
}

function fmtScore(score: number, detail?: ScoreDetail): string {
  const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  const suffix =
    detail && detail.note
      ? ` _(${detail.note})_`
      : detail
        ? ` _(${detail.rate.passed}/${detail.rate.total} related steps passed)_`
        : '';
  return `\`${bar}\` **${score}/100**${suffix}`;
}

function renderDeploymentSection(deployment: DeploymentResult | null): string {
  if (!deployment) {
    return [
      '## Deployment Health Summary',
      '',
      '_No deployment results were available. The deployment validator output was not found, so this section is omitted._',
      '',
    ].join('\n');
  }

  const passCount = deployment.checks.filter((c) => c.status === 'pass').length;
  const warnCount = deployment.checks.filter((c) => c.status === 'warn').length;
  const failCount = deployment.checks.filter((c) => c.status === 'fail').length;

  const lines: string[] = [
    '## Deployment Health Summary',
    '',
    `- Overall status: ${deployment.allHealthy ? '✅ All services healthy' : '❌ Issues detected'}`,
    `- Boot time: ${deployment.bootTime} ms`,
    `- Checks: ${passCount} passed, ${warnCount} warned, ${failCount} failed`,
    '',
    '| Service | Check | Status | Duration | Detail |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const check of deployment.checks) {
    const detail = (check.detail ?? '').replace(/\|/g, '\\|');
    lines.push(
      `| ${check.service} | ${check.check} | ${statusIcon(check.status)} ${check.status} | ${check.duration} ms | ${detail} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderPassedWorkflowsSection(passedWorkflows: string[], results: WorkflowResult[]): string {
  const lines: string[] = ['## Passed Workflows', ''];
  if (results.length === 0) {
    lines.push('_No workflow results were available._', '');
    return lines.join('\n');
  }
  if (passedWorkflows.length === 0) {
    lines.push('_No workflows passed validation._', '');
  } else {
    for (const name of passedWorkflows) {
      const wf = results.find((w) => w.name === name);
      const stepInfo = wf ? ` (${wf.steps.filter((s) => s.passed).length}/${wf.steps.length} steps)` : '';
      lines.push(`- ✅ ${name}${stepInfo}`);
    }
    lines.push('');
  }

  // Also surface workflows that did not fully pass for completeness.
  const failed = results.filter((w) => !w.passed);
  if (failed.length > 0) {
    lines.push('**Workflows with failures:**', '');
    for (const wf of failed) {
      const passedSteps = wf.steps.filter((s) => s.passed).length;
      lines.push(`- ❌ ${wf.name} (${passedSteps}/${wf.steps.length} steps passed)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderBugsSection(bugs: Bug[]): string {
  const lines: string[] = ['## Bugs', ''];
  if (bugs.length === 0) {
    lines.push('_No bugs were discovered during validation._', '');
    return lines.join('\n');
  }

  const order: Bug['severity'][] = ['critical', 'major', 'minor'];
  const labels: Record<Bug['severity'], string> = {
    critical: 'Critical',
    major: 'Major',
    minor: 'Minor',
  };

  for (const severity of order) {
    const group = bugs.filter((b) => b.severity === severity);
    if (group.length === 0) continue;
    lines.push(`### ${severityEmoji(severity)} ${labels[severity]} (${group.length})`, '');
    for (const bug of group) {
      lines.push(`#### ${bug.id} — ${bug.workflow}`);
      lines.push('');
      lines.push(`- **Description:** ${bug.description}`);
      lines.push(`- **Reproduction steps:**`);
      for (const repro of bug.reproductionSteps) {
        lines.push(`  1. ${repro}`);
      }
      lines.push(`- **Expected:** ${bug.expected}`);
      lines.push(`- **Actual:** ${bug.actual}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

function renderFrictionSection(frictionPoints: FrictionPoint[]): string {
  const lines: string[] = ['## UX & Operational Friction Points', ''];
  if (frictionPoints.length === 0) {
    lines.push(
      '_No automated friction points were detected. Record UX friction observed during manual UI validation (see `docs/MANUAL_UI_CHECKLIST.md`) here._',
      '',
    );
    return lines.join('\n');
  }
  lines.push('| ID | Area | Description | Suggested Improvement |');
  lines.push('| --- | --- | --- | --- |');
  for (const fp of frictionPoints) {
    lines.push(
      `| ${fp.id} | ${fp.area} | ${fp.description.replace(/\|/g, '\\|')} | ${fp.suggestedImprovement.replace(/\|/g, '\\|')} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderEnvironmentSection(
  env: FrictionReport['environment'],
  generatedAt: string,
  missing: string[],
): string {
  const lines: string[] = [
    '## Environment',
    '',
    `- Generated at: ${generatedAt}`,
    `- Node version: ${env.nodeVersion}`,
    `- Platform: ${env.platform}`,
    `- Docker Compose version: ${env.composeVersion}`,
  ];
  if (missing.length > 0) {
    lines.push('');
    lines.push('> ⚠️ The following inputs were missing and the report was generated with available data only:');
    for (const m of missing) {
      lines.push(`> - ${m}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderReadinessSection(
  readiness: ProductionReadiness,
  details: Record<string, ScoreDetail>,
): string {
  const lines: string[] = [
    '## Production Readiness Summary',
    '',
    'Each score is the percentage of related validation steps that passed.',
    '',
    `- **Deployment Confidence:** ${fmtScore(readiness.deploymentConfidence, details.deploymentConfidence)}`,
    `- **Operational Maturity:** ${fmtScore(readiness.operationalMaturity, details.operationalMaturity)}`,
    `- **AI Safety Readiness:** ${fmtScore(readiness.aiSafetyReadiness, details.aiSafetyReadiness)}`,
    `- **Security Readiness:** ${fmtScore(readiness.securityReadiness, details.securityReadiness)}`,
    '',
    '### Production Blockers',
    '',
  ];

  if (readiness.productionBlockers.length === 0) {
    lines.push('_No critical or major blockers. No deploy-blocking bugs were found._', '');
  } else {
    for (const blocker of readiness.productionBlockers) {
      lines.push(`- ${blocker}`);
    }
    lines.push('');
  }

  lines.push('### Recommended Next Actions', '');
  readiness.recommendedNextActions.forEach((action, idx) => {
    lines.push(`${idx + 1}. ${action}`);
  });
  lines.push('');
  return lines.join('\n');
}

function buildMarkdown(
  report: FrictionReport,
  readiness: ProductionReadiness,
  details: Record<string, ScoreDetail>,
  results: WorkflowResult[],
  missing: string[],
): string {
  const sections: string[] = [
    '# LMS Real Usage Validation — Friction Report',
    '',
    `_Generated at ${report.generatedAt}_`,
    '',
    renderEnvironmentSection(report.environment, report.generatedAt, missing),
    renderDeploymentSection(report.deploymentHealth ?? null),
    renderPassedWorkflowsSection(report.passedWorkflows, results),
    renderBugsSection(report.bugs),
    renderFrictionSection(report.frictionPoints),
    renderReadinessSection(readiness, details),
  ];
  return sections.join('\n');
}

// ─── Main Entry ────────────────────────────────────────────────────────────────

/**
 * Build the friction report from the persisted validation artifacts and write
 * it to `docs/FRICTION_REPORT.md`. Returns the assembled FrictionReport so the
 * orchestrator can use it programmatically.
 */
export async function generateReport(): Promise<FrictionReport> {
  const { workflowResults, deployment, missing } = loadInputs();

  const environment = getEnvironment();
  const generatedAt = new Date().toISOString();

  const bugs = extractBugs(workflowResults);
  const frictionPoints = extractFrictionPoints(deployment);
  const passedWorkflows = workflowResults.filter((w) => w.passed).map((w) => w.name);

  const { readiness, details } = computeReadiness(workflowResults, deployment);

  // The FrictionReport type requires a DeploymentResult; when deployment data is
  // missing we supply an empty, clearly-degraded placeholder.
  const deploymentHealth: DeploymentResult =
    deployment ?? { allHealthy: false, bootTime: 0, checks: [] };

  const report: FrictionReport = {
    generatedAt,
    environment,
    deploymentHealth,
    workflowResults,
    bugs,
    frictionPoints,
    passedWorkflows,
  };

  const markdown = buildMarkdown(
    report,
    readiness,
    details,
    workflowResults,
    missing,
  );

  // Ensure the docs directory exists before writing.
  const docsDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, markdown, 'utf-8');

  console.log(`Friction report written to ${REPORT_PATH}`);
  console.log(
    `  Bugs: ${bugs.length} (${bugs.filter((b) => b.severity === 'critical').length} critical, ` +
      `${bugs.filter((b) => b.severity === 'major').length} major, ` +
      `${bugs.filter((b) => b.severity === 'minor').length} minor)`,
  );
  console.log(
    `  Readiness — deploy: ${readiness.deploymentConfidence}, ops: ${readiness.operationalMaturity}, ` +
      `ai-safety: ${readiness.aiSafetyReadiness}, security: ${readiness.securityReadiness}`,
  );
  if (missing.length > 0) {
    console.warn(`  Generated with missing inputs: ${missing.join('; ')}`);
  }

  return report;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  generateReport()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Report generation failed:', message);
      process.exit(1);
    });
}
