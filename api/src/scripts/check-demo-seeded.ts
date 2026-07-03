/**
 * Exit 0 if demo data appears to be seeded (default tenant has ≥1 course),
 * exit 1 otherwise. Used by `npm run bootstrap:auto` to decide whether to
 * run the full bootstrap flow.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: 'default' },
      select: { id: true },
    });
    if (!tenant) {
      console.log('demo:missing (no default tenant)');
      process.exit(1);
    }
    const courseCount = await prisma.course.count({ where: { tenantId: tenant.id } });
    if (courseCount === 0) {
      console.log('demo:missing (no courses)');
      process.exit(1);
    }
    console.log(`demo:present (${courseCount} courses)`);
    process.exit(0);
  } catch (err: any) {
    // DB unreachable or schema not migrated → treat as missing so bootstrap runs.
    console.log(`demo:missing (${err?.message ?? 'db error'})`);
    process.exit(1);
  } finally {
    // no-op
  }
}

main();