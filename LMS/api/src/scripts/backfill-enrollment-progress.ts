/**
 * Backfill: normalize Enrollment.progress to a 0–1 fraction.
 *
 * Context: `Progress` recompute previously stored `Enrollment.progress` as a
 * 0–100 percentage, while the frontend renders `enrollment.progress * 100`.
 * The recompute logic now stores a 0–1 fraction. This one-off script brings
 * existing rows in line so historical enrollments display correctly without
 * waiting for the next lesson-progress update to recompute them.
 *
 * Method: recompute each enrollment's progress from its lesson-level Progress
 * records (the source of truth) — completedLessons / totalLessons. This is the
 * same derivation `ProgressService.recomputeEnrollmentProgress` uses, so it is
 * correct whether the stored value was a percentage or already a fraction, and
 * it is idempotent (safe to run multiple times).
 *
 * Usage (from api/):
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-enrollment-progress.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadProjectEnv } from '../env';

loadProjectEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  await prisma.$connect();

  try {
    console.log('▸ Backfilling enrollment progress (0–100 → 0–1 fraction)...');

    const enrollments = await prisma.enrollment.findMany({
      select: { id: true, courseId: true, progress: true, completedAt: true },
    });

    let updated = 0;
    let unchanged = 0;

    for (const enrollment of enrollments) {
      const totalLessons = await prisma.lesson.count({
        where: { module: { courseId: enrollment.courseId } },
      });

      const completedLessons = await prisma.progress.count({
        where: { enrollmentId: enrollment.id, state: 'completed' },
      });

      const fraction =
        totalLessons > 0 ? completedLessons / totalLessons : 0;
      const allDone = totalLessons > 0 && completedLessons === totalLessons;

      // Only write when something actually differs, to keep the run quiet and
      // avoid needless churn. Compare with a small epsilon for float safety.
      const progressChanged = Math.abs((enrollment.progress ?? 0) - fraction) > 1e-9;
      const completionChanged = allDone !== (enrollment.completedAt !== null);

      if (!progressChanged && !completionChanged) {
        unchanged++;
        continue;
      }

      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          progress: fraction,
          completedAt: allDone
            ? (enrollment.completedAt ?? new Date())
            : null,
        },
      });
      updated++;
      console.log(
        `  ✓ ${enrollment.id}: ${completedLessons}/${totalLessons} → ${(fraction * 100).toFixed(0)}%`,
      );
    }

    console.log(
      `Backfill complete. Updated ${updated}, unchanged ${unchanged}, total ${enrollments.length}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
