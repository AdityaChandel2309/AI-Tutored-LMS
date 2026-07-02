import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

interface EnvCheck {
  key: string;
  required: boolean;
  fallback?: string;
}

const REQUIRED_VARS: EnvCheck[] = [
  { key: 'DATABASE_URL', required: true },
  { key: 'KEYCLOAK_CLIENT_SECRET', required: true },
  { key: 'KEYCLOAK_INTERNAL_URL', required: true, fallback: 'http://localhost:8080' },
  { key: 'MINIO_ENDPOINT', required: true, fallback: 'http://localhost:9000' },
  { key: 'MINIO_BUCKET', required: true, fallback: 'lms-avatars' },
  { key: 'MINIO_ACCESS_KEY', required: false },
  { key: 'MINIO_SECRET_KEY', required: false },
  { key: 'CORS_ORIGINS', required: false },
  { key: 'LLM_API_KEY', required: false },
  { key: 'LLM_API_URL', required: false },
];

/**
 * Validates required environment variables at startup.
 * Logs warnings for missing optional vars, throws for missing required vars.
 */
export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const check of REQUIRED_VARS) {
    const value = process.env[check.key]?.trim();

    if (!value && !check.fallback) {
      if (check.required) {
        missing.push(check.key);
        logger.error(`Missing required env var: ${check.key}`);
      } else {
        logger.warn(`Optional env var not set: ${check.key}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Environment validation failed. Missing required variables: ${missing.join(', ')}`,
    );
  }

  logger.log('Environment validation passed');
}
