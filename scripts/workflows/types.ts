/**
 * Shared types and interfaces for the LMS validation workflow suite.
 */

// ─── Workflow Test Results ────────────────────────────────────────────────────

export interface StepResult {
  description: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  duration: number; // ms
}

export interface WorkflowResult {
  name: string;
  steps: StepResult[];
  passed: boolean;
  duration: number; // ms
  error?: string;
}

// ─── Deployment Validation ───────────────────────────────────────────────────

export interface DeploymentCheck {
  service: string;
  check: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number; // ms
  detail?: string;
}

export interface DeploymentResult {
  allHealthy: boolean;
  bootTime: number; // ms
  checks: DeploymentCheck[];
}

// ─── Friction Report ─────────────────────────────────────────────────────────

export interface Bug {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  workflow: string;
  description: string;
  reproductionSteps: string[];
  expected: string;
  actual: string;
}

export interface FrictionPoint {
  id: string;
  area: string;
  description: string;
  suggestedImprovement: string;
}

export interface FrictionReport {
  generatedAt: string;
  environment: {
    composeVersion: string;
    nodeVersion: string;
    platform: string;
  };
  deploymentHealth: DeploymentResult;
  workflowResults: WorkflowResult[];
  bugs: Bug[];
  frictionPoints: FrictionPoint[];
  passedWorkflows: string[];
}

// ─── Seed Script ─────────────────────────────────────────────────────────────

export interface SeedUser {
  id: string;
  keycloakId: string;
  email: string;
  password: string;
  role: 'admin' | 'instructor' | 'learner' | 'employee-only';
}

export interface SeedResult {
  tenant: { id: string; subdomain: string };
  users: {
    admin: SeedUser;
    instructor: SeedUser;
    learner: SeedUser;
    employeeOnly?: SeedUser;
  };
  departments: { parentId: string; childId: string };
  designations: { seniorId: string; juniorId: string };
  categories: string[];
  courses: {
    publishedId: string;
    reviewId: string;
    draftId: string;
  };
  assessments: { courseId: string; assessmentId: string }[];
  certificateTemplateId: string;
  documents: string[];
  documentCategories: string[];
  project: { id: string; milestoneIds: string[] };
  summary: Record<string, number>;
}

// ─── Production Readiness ────────────────────────────────────────────────────

export interface ProductionReadiness {
  deploymentConfidence: number;   // 0–100
  operationalMaturity: number;    // 0–100
  aiSafetyReadiness: number;      // 0–100
  securityReadiness: number;      // 0–100
  productionBlockers: string[];
  recommendedNextActions: string[];
}
