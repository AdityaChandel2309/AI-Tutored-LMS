/**
 * Idempotent boot-time seed. Runs on every `api` container start (via the
 * docker-compose command) and no-ops when demo data already exists. Guarded
 * by the AUTO_SEED_DEMO env var so production images never seed unexpectedly.
 *
 *   AUTO_SEED_DEMO=true → run seed-tenant + seed-users + seed-demo-full
 *   AUTO_SEED_DEMO=false / unset → exit 0 immediately
 *
 * Every underlying script is already idempotent (upserts by natural key), so
 * running this on every boot is safe. It also survives `docker compose down -v`
 * because the container re-provisions from a clean database.
 */

import { spawnSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadProjectEnv } from '../env';

loadProjectEnv();

const DEMO_TENANT_SUBDOMAIN = 'default';
const DEMO_MARKER_SLUG = 'new-hire-onboarding';

function shouldRun(): boolean {
  const flag = (process.env.AUTO_SEED_DEMO ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

async function alreadySeeded(url: string): Promise<boolean> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    await prisma.$connect();
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: DEMO_TENANT_SUBDOMAIN },
      select: { id: true },
    });
    if (!tenant) return false;
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, slug: DEMO_MARKER_SLUG },
      select: { id: true },
    });
    return !!course;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

function runScript(rel: string): void {
  const compiled = require('path').join(__dirname, rel + '.js');
  const fs = require('fs') as typeof import('fs');
  const target = fs.existsSync(compiled) ? compiled : rel;
  console.log(`▸ auto-seed: running ${target}`);
  const res = spawnSync(process.execPath, [target], {
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`Sub-script ${rel} failed with exit code ${res.status}`);
  }
}

async function main() {
  if (!shouldRun()) {
    console.log('▸ auto-seed: AUTO_SEED_DEMO not set — skipping.');
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('▸ auto-seed: DATABASE_URL not set — skipping.');
    return;
  }
  if (await alreadySeeded(url)) {
    console.log('▸ auto-seed: demo data already present — skipping.');
    return;
  }
  console.log('▸ auto-seed: seeding tenant, users, and demo content…');
  try {
    runScript('seed-tenant');
    runScript('seed-users');
    runScript('seed-demo-full');
    console.log('✅ auto-seed complete.');
  } catch (err) {
    // Never fail the container start if seeding fails; log and continue.
    console.error('⚠ auto-seed failed (non-fatal):', (err as Error).message);
  }
}

main().catch((err) => {
  console.error('⚠ auto-seed crashed (non-fatal):', err);
  process.exit(0);
});