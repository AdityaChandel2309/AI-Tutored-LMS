export interface StepResult {
    description: string;
    passed: boolean;
    expected?: string;
    actual?: string;
    duration: number;
}
export interface WorkflowResult {
    name: string;
    steps: StepResult[];
    passed: boolean;
    duration: number;
    error?: string;
}
export interface DeploymentCheck {
    service: string;
    check: string;
    status: 'pass' | 'fail' | 'warn';
    duration: number;
    detail?: string;
}
export interface DeploymentResult {
    allHealthy: boolean;
    bootTime: number;
    checks: DeploymentCheck[];
}
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
export interface SeedUser {
    id: string;
    keycloakId: string;
    email: string;
    password: string;
    role: 'admin' | 'instructor' | 'learner' | 'employee-only';
}
export interface SeedResult {
    tenant: {
        id: string;
        subdomain: string;
    };
    users: {
        admin: SeedUser;
        instructor: SeedUser;
        learner: SeedUser;
        employeeOnly?: SeedUser;
    };
    departments: {
        parentId: string;
        childId: string;
    };
    designations: {
        seniorId: string;
        juniorId: string;
    };
    categories: string[];
    courses: {
        publishedId: string;
        reviewId: string;
        draftId: string;
    };
    assessments: {
        courseId: string;
        assessmentId: string;
    }[];
    certificateTemplateId: string;
    documents: string[];
    documentCategories: string[];
    project: {
        id: string;
        milestoneIds: string[];
    };
    summary: Record<string, number>;
}
export interface ProductionReadiness {
    deploymentConfidence: number;
    operationalMaturity: number;
    aiSafetyReadiness: number;
    securityReadiness: number;
    productionBlockers: string[];
    recommendedNextActions: string[];
}
