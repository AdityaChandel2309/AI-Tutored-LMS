import { WorkflowResult, StepResult, SeedUser, ProductionReadiness } from './types.js';
import { getToken, apiClient, getMultiRoleTokens, sleep, timed } from './helpers.js';

// Quick compile check - just verify types are accessible
const user: SeedUser = {
  id: 'test-id',
  keycloakId: 'kc-id',
  email: 'test@example.com',
  password: 'password',
  role: 'admin',
};

const step: StepResult = {
  description: 'test step',
  passed: true,
  duration: 100,
};

const result: WorkflowResult = {
  name: 'test',
  steps: [step],
  passed: true,
  duration: 200,
};

const readiness: ProductionReadiness = {
  deploymentConfidence: 85,
  operationalMaturity: 70,
  aiSafetyReadiness: 60,
  securityReadiness: 90,
  productionBlockers: [],
  recommendedNextActions: ['Add monitoring'],
};

console.log('✓ All types compile correctly');
console.log('✓ Exports available:', {
  getToken: typeof getToken,
  apiClient: typeof apiClient,
  getMultiRoleTokens: typeof getMultiRoleTokens,
  sleep: typeof sleep,
  timed: typeof timed,
});
