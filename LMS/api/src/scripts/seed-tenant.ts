import { PrismaService } from '../prisma/prisma.service';
import { loadProjectEnv } from '../env';

loadProjectEnv();

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  const tenant = await prisma.tenant.upsert({
    where: {
      subdomain: 'default',
    },
    create: {
      name: 'Default LMS',
      subdomain: 'default',
    },
    update: {
      name: 'Default LMS',
    },
  });

  console.log('Default tenant ready:', tenant);

  await prisma.$executeRaw`
    UPDATE "User"
    SET "tenantId" = ${tenant.id}
    WHERE "tenantId" IS NULL
  `;

  console.log('Users without tenant assigned');

  await prisma.$disconnect();
}

main().catch(console.error);
