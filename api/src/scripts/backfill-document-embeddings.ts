/**
 * Backfill: generate embeddings for existing knowledge documents.
 *
 * Context: `DocumentEmbeddingService` originally embedded only title +
 * description. The service now also embeds extracted body text (PDFs,
 * text formats) but existing documents were indexed before the change
 * — either metadata-only or not at all. This script walks every
 * non-archived document per tenant, downloads its file from storage,
 * extracts text where possible, and indexes any document that has no
 * chunks yet. Idempotent: documents that already have chunks are skipped.
 *
 * Usage (from api/):
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-document-embeddings.ts
 *   # or, to scope to a single tenant:
 *   TENANT_ID=<uuid> npx ts-node -r tsconfig-paths/register src/scripts/backfill-document-embeddings.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { loadProjectEnv } from '../env';

loadProjectEnv();

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const knowledge = app.get(KnowledgeService);

    const tenantFilter = process.env.TENANT_ID;
    const tenants = tenantFilter
      ? await prisma.tenant.findMany({ where: { id: tenantFilter } })
      : await prisma.tenant.findMany();

    if (tenants.length === 0) {
      console.log('No tenants found — nothing to backfill.');
      return;
    }

    let totalScanned = 0;
    let totalIndexed = 0;

    for (const tenant of tenants) {
      console.log(`▸ Tenant "${tenant.name}" (${tenant.id})`);
      const { scanned, indexed } = await knowledge.backfillEmbeddings(tenant.id);
      console.log(`  scanned=${scanned} indexed=${indexed}`);
      totalScanned += scanned;
      totalIndexed += indexed;
    }

    console.log(`✔ Done. scanned=${totalScanned} indexed=${totalIndexed}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});