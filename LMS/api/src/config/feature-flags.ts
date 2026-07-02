/**
 * Environment-driven feature flags.
 * All flags default to false unless explicitly enabled via env vars.
 * Pattern: FEATURE_<FLAG_NAME>=true|1
 */

export interface FeatureFlags {
  aiTutor: boolean;
  knowledgeAssistant: boolean;
  scormPackages: boolean;
  certificates: boolean;
  projectTracking: boolean;
  csvImport: boolean;
}

function isEnabled(envVar: string): boolean {
  const val = process.env[envVar]?.trim().toLowerCase();
  return val === 'true' || val === '1';
}

export function getFeatureFlags(): FeatureFlags {
  return {
    aiTutor: isEnabled('FEATURE_AI_TUTOR'),
    knowledgeAssistant: isEnabled('FEATURE_KNOWLEDGE_ASSISTANT'),
    scormPackages: isEnabled('FEATURE_SCORM'),
    certificates: isEnabled('FEATURE_CERTIFICATES'),
    projectTracking: isEnabled('FEATURE_PROJECTS'),
    csvImport: isEnabled('FEATURE_CSV_IMPORT'),
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}
