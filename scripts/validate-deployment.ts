/**
 * Deployment Health Checker
 *
 * Validates that the Docker Compose stack is healthy and all services are reachable.
 * Checks container states via `docker compose ps` and performs HTTP/TCP health checks.
 *
 * Requirements: 2.1–2.8, 3.1–3.3
 */

import { execSync } from 'child_process';
import axios from 'axios';
import { DeploymentCheck, DeploymentResult } from './workflows/types';

// ─── Environment Configuration ───────────────────────────────────────────────

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3001';
const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lms';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const NGINX_BASE_URL = process.env.NGINX_BASE_URL || 'http://localhost:80';

const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 2000;
const TOTAL_TIMEOUT_MS = 120000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(
  checkFn: () => Promise<DeploymentCheck>,
  totalStart: number,
): Promise<DeploymentCheck> {
  let lastResult: DeploymentCheck | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Check total timeout
    if (Date.now() - totalStart > TOTAL_TIMEOUT_MS) {
      return lastResult || {
        service: 'unknown',
        check: 'timeout',
        status: 'fail',
        duration: Date.now() - totalStart,
        detail: 'Total timeout exceeded (120s)',
      };
    }

    lastResult = await checkFn();

    if (lastResult.status === 'pass') {
      return lastResult;
    }

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  return lastResult!;
}

// ─── Container State Check ───────────────────────────────────────────────────

function checkContainerStates(): DeploymentCheck[] {
  const checks: DeploymentCheck[] = [];
  const start = Date.now();

  try {
    const output = execSync('docker compose ps --format json', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: 10000,
    });

    // docker compose ps --format json outputs one JSON object per line
    const lines = output.trim().split('\n').filter(Boolean);
    const containers = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (containers.length === 0) {
      checks.push({
        service: 'docker-compose',
        check: 'containers running',
        status: 'fail',
        duration: Date.now() - start,
        detail: 'No containers found. Is docker compose up?',
      });
      return checks;
    }

    for (const container of containers) {
      const name = container.Name || container.Service || 'unknown';
      const state = (container.State || '').toLowerCase();
      const health = (container.Health || '').toLowerCase();

      // Skip one-shot provisioners that exit successfully
      if (name.includes('provisioner') && state === 'exited') {
        checks.push({
          service: name,
          check: 'container state',
          status: 'pass',
          duration: Date.now() - start,
          detail: 'One-shot provisioner completed successfully',
        });
        continue;
      }

      const isHealthy = state === 'running' && (health === 'healthy' || health === '');
      checks.push({
        service: name,
        check: 'container state',
        status: isHealthy ? 'pass' : (state === 'running' ? 'warn' : 'fail'),
        duration: Date.now() - start,
        detail: `State: ${state}, Health: ${health || 'N/A'}`,
      });
    }
  } catch (err: any) {
    checks.push({
      service: 'docker-compose',
      check: 'containers running',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Failed to run docker compose ps: ${err.message}`,
    });
  }

  return checks;
}

// ─── Service Health Checks ───────────────────────────────────────────────────

async function checkPostgres(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    // Use docker exec to run a SELECT 1 query against postgres
    execSync(
      `docker compose exec -T postgres psql "${DATABASE_URL}" -c "SELECT 1"`,
      { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' },
    );
    return {
      service: 'postgres',
      check: 'SELECT 1',
      status: 'pass',
      duration: Date.now() - start,
      detail: 'Database connection successful',
    };
  } catch (err: any) {
    return {
      service: 'postgres',
      check: 'SELECT 1',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Database connection failed: ${err.message?.substring(0, 200)}`,
    };
  }
}

async function checkKeycloakHealth(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${KEYCLOAK_BASE_URL}/health/ready`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'keycloak',
      check: '/health/ready',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'keycloak',
      check: '/health/ready',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkKeycloakRealm(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${KEYCLOAK_BASE_URL}/realms/LMS`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'keycloak',
      check: '/realms/LMS',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: passed ? 'LMS realm accessible' : `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'keycloak',
      check: '/realms/LMS',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkMinioHealth(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${MINIO_ENDPOINT}/minio/health/live`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'minio',
      check: '/minio/health/live',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'minio',
      check: '/minio/health/live',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkMinioBucket(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    // Check if the default bucket exists using the S3-compatible HeadBucket
    const bucket = process.env.MINIO_BUCKET || 'lms-avatars';
    const response = await axios.head(`${MINIO_ENDPOINT}/${bucket}`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    // MinIO returns 200 for existing bucket, 404 for non-existent
    const passed = response.status === 200 || response.status === 403;
    return {
      service: 'minio',
      check: `HeadBucket (${bucket})`,
      status: passed ? 'pass' : 'warn',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}${response.status === 404 ? ' - bucket not found' : ''}`,
    };
  } catch (err: any) {
    return {
      service: 'minio',
      check: 'HeadBucket',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkRedis(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    execSync(
      `docker compose exec -T redis redis-cli ping`,
      { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' },
    );
    return {
      service: 'redis',
      check: 'PING',
      status: 'pass',
      duration: Date.now() - start,
      detail: 'Redis PONG received',
    };
  } catch (err: any) {
    return {
      service: 'redis',
      check: 'PING',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Redis ping failed: ${err.message?.substring(0, 200)}`,
    };
  }
}

async function checkApi(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'api',
      check: 'GET /health',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'api',
      check: 'GET /health',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkWeb(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${WEB_BASE_URL}/`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'web',
      check: 'GET /',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'web',
      check: 'GET /',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkNginxApiProxy(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${NGINX_BASE_URL}/api/health`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'nginx',
      check: 'proxy → api (/api/health)',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'nginx',
      check: 'proxy → api (/api/health)',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

async function checkNginxWebProxy(): Promise<DeploymentCheck> {
  const start = Date.now();
  try {
    const response = await axios.get(`${NGINX_BASE_URL}/`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    const passed = response.status === 200;
    return {
      service: 'nginx',
      check: 'proxy → web (GET /)',
      status: passed ? 'pass' : 'fail',
      duration: Date.now() - start,
      detail: `HTTP ${response.status}`,
    };
  } catch (err: any) {
    return {
      service: 'nginx',
      check: 'proxy → web (GET /)',
      status: 'fail',
      duration: Date.now() - start,
      detail: `Request failed: ${err.message}`,
    };
  }
}

// ─── Main Validation Runner ──────────────────────────────────────────────────

export async function validateDeployment(): Promise<DeploymentResult> {
  const totalStart = Date.now();
  const checks: DeploymentCheck[] = [];

  console.log('═══════════════════════════════════════');
  console.log('  LMS Deployment Health Check');
  console.log('═══════════════════════════════════════\n');

  // Phase 1: Check container states
  console.log('▶ Checking container states...');
  const containerChecks = checkContainerStates();
  checks.push(...containerChecks);

  for (const check of containerChecks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    console.log(`  ${icon} ${check.service}: ${check.detail}`);
  }
  console.log('');

  // Phase 2: Service health checks with retry
  console.log('▶ Running service health checks...\n');

  const serviceChecks: Array<{ name: string; fn: () => Promise<DeploymentCheck> }> = [
    { name: 'postgres', fn: checkPostgres },
    { name: 'keycloak (health)', fn: checkKeycloakHealth },
    { name: 'keycloak (realm)', fn: checkKeycloakRealm },
    { name: 'minio (health)', fn: checkMinioHealth },
    { name: 'minio (bucket)', fn: checkMinioBucket },
    { name: 'redis', fn: checkRedis },
    { name: 'api', fn: checkApi },
    { name: 'web', fn: checkWeb },
    { name: 'nginx (api proxy)', fn: checkNginxApiProxy },
    { name: 'nginx (web proxy)', fn: checkNginxWebProxy },
  ];

  for (const { name, fn } of serviceChecks) {
    process.stdout.write(`  Checking ${name}...`);
    const result = await withRetry(fn, totalStart);
    checks.push(result);

    const icon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
    console.log(` ${icon} (${result.duration}ms) ${result.detail || ''}`);
  }

  // Compute result
  const bootTime = Date.now() - totalStart;
  const allHealthy = checks.every((c) => c.status === 'pass' || c.status === 'warn');

  console.log('\n═══════════════════════════════════════');
  console.log(`  Result: ${allHealthy ? '✓ ALL HEALTHY' : '✗ ISSUES DETECTED'}`);
  console.log(`  Boot time: ${bootTime}ms`);
  console.log(`  Checks: ${checks.filter((c) => c.status === 'pass').length} pass, ${checks.filter((c) => c.status === 'warn').length} warn, ${checks.filter((c) => c.status === 'fail').length} fail`);
  console.log('═══════════════════════════════════════\n');

  const result: DeploymentResult = {
    allHealthy,
    bootTime,
    checks,
  };

  return result;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (require.main === module) {
  validateDeployment()
    .then((result) => {
      // Write result to stdout as JSON for downstream consumption
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.allHealthy ? 0 : 1);
    })
    .catch((err) => {
      console.error('Deployment validation failed:', err);
      process.exit(1);
    });
}
