import { loadProjectEnv } from '../env';

type DeploymentTarget = 'local' | 'shared' | 'production';

type Check = {
  key: string;
  required: boolean;
  value: string | null;
  note?: string;
};

function getTarget(): DeploymentTarget {
  const rawTarget = process.argv[2]?.trim().toLowerCase() ?? 'local';

  if (
    rawTarget === 'local' ||
    rawTarget === 'shared' ||
    rawTarget === 'production'
  ) {
    return rawTarget;
  }

  throw new Error(`Unsupported deployment target: ${rawTarget}`);
}

function readEnv(key: string) {
  return process.env[key]?.trim() || null;
}

function hasStorageAccessKey() {
  return readEnv('MINIO_ACCESS_KEY') ?? readEnv('MINIO_ROOT_USER');
}

function hasStorageSecretKey() {
  return readEnv('MINIO_SECRET_KEY') ?? readEnv('MINIO_ROOT_PASSWORD');
}

function withLocalFallback(
  target: DeploymentTarget,
  value: string | null,
  fallback: string,
) {
  if (value) {
    return value;
  }

  return target === 'local' ? fallback : null;
}

function createChecks(target: DeploymentTarget): Check[] {
  const localOnly = target === 'local';

  return [
    {
      key: 'DATABASE_URL',
      required: true,
      value: readEnv('DATABASE_URL'),
    },
    {
      key: 'API_PUBLIC_URL',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('API_PUBLIC_URL'),
        'http://localhost:3000',
      ),
    },
    {
      key: 'CORS_ORIGINS',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('CORS_ORIGINS'),
        'http://localhost:3001,http://127.0.0.1:3001',
      ),
    },
    {
      key: 'FRONTEND_APP_URL',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('FRONTEND_APP_URL'),
        'http://localhost:3001',
      ),
    },
    {
      key: 'KEYCLOAK_BASE_URL',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('KEYCLOAK_BASE_URL'),
        'http://localhost:8080',
      ),
    },
    {
      key: 'KEYCLOAK_INTERNAL_URL',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('KEYCLOAK_INTERNAL_URL'),
        'http://localhost:8080',
      ),
    },
    {
      key: 'KEYCLOAK_REALM',
      required: true,
      value: withLocalFallback(target, readEnv('KEYCLOAK_REALM'), 'LMS'),
    },
    {
      key: 'KEYCLOAK_CLIENT_ID',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('KEYCLOAK_CLIENT_ID'),
        'lms-web',
      ),
    },
    {
      key: 'KEYCLOAK_CLIENT_SECRET',
      required: true,
      value: readEnv('KEYCLOAK_CLIENT_SECRET'),
    },
    {
      key: 'KEYCLOAK_REDIRECT_URI',
      required: true,
      value: withLocalFallback(
        target,
        readEnv('KEYCLOAK_REDIRECT_URI'),
        'http://localhost:3001/callback',
      ),
    },
    {
      key: 'KEYCLOAK_ADMIN_USER',
      required: !localOnly,
      value: readEnv('KEYCLOAK_ADMIN_USER'),
      note: 'Required for admin-user flows and realm provisioning outside local-only workflows.',
    },
    {
      key: 'KEYCLOAK_ADMIN_PASSWORD',
      required: !localOnly,
      value: readEnv('KEYCLOAK_ADMIN_PASSWORD'),
      note: 'Required for admin-user flows and realm provisioning outside local-only workflows.',
    },
    {
      key: 'MINIO_ENDPOINT',
      required: !localOnly,
      value: withLocalFallback(
        target,
        readEnv('MINIO_ENDPOINT'),
        'http://localhost:9000',
      ),
    },
    {
      key: 'MINIO_PUBLIC_BASE_URL',
      required: !localOnly,
      value: withLocalFallback(
        target,
        readEnv('MINIO_PUBLIC_BASE_URL'),
        'http://localhost:9000',
      ),
    },
    {
      key: 'MINIO_BUCKET',
      required: true,
      value: withLocalFallback(target, readEnv('MINIO_BUCKET'), 'lms-avatars'),
    },
    {
      key: 'MINIO_REGION',
      required: true,
      value: withLocalFallback(target, readEnv('MINIO_REGION'), 'us-east-1'),
    },
    {
      key: 'MINIO_ACCESS_KEY|MINIO_ROOT_USER',
      required: !localOnly,
      value: hasStorageAccessKey(),
      note: 'Explicit MINIO_ACCESS_KEY is preferred for shared and production environments.',
    },
    {
      key: 'MINIO_SECRET_KEY|MINIO_ROOT_PASSWORD',
      required: !localOnly,
      value: hasStorageSecretKey(),
      note: 'Explicit MINIO_SECRET_KEY is preferred for shared and production environments.',
    },
  ];
}

function formatValue(value: string | null) {
  if (!value) {
    return 'missing';
  }

  if (value.length <= 6) {
    return 'set';
  }

  return `${value.slice(0, 3)}...set`;
}

function main() {
  loadProjectEnv();

  const target = getTarget();
  const checks = createChecks(target);
  const failures = checks.filter((check) => check.required && !check.value);

  console.log(`Runtime config preflight for target: ${target}`);

  for (const check of checks) {
    const status = check.required && !check.value ? 'FAIL' : 'OK';

    console.log(`[${status}] ${check.key}: ${formatValue(check.value)}`);

    if (check.note) {
      console.log(`      ${check.note}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `Runtime config verification failed for ${target}. Missing required values: ${failures
        .map((failure) => failure.key)
        .join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`Runtime config verification passed for ${target}.`);
}

try {
  main();
} catch (error) {
  console.error('Runtime config verification failed:', error);
  process.exit(1);
}
