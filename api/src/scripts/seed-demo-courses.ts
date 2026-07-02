/**
 * Demo Course Seed
 *
 * Creates exactly TWO fully-built, PUBLISHED courses in the default tenant so
 * the course catalog (localhost:8081/dashboard/courses) shows working content
 * a learner can flow through end-to-end:
 *   - real categories
 *   - modules in order
 *   - lessons in order, each with readable text content
 *
 * Idempotent: safe to run multiple times. Re-running updates titles/content
 * and (re)builds the module/lesson tree for the two demo courses without
 * duplicating rows.
 *
 * Usage (from api/):
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-courses.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadProjectEnv } from '../env';

loadProjectEnv();

const TENANT_SUBDOMAIN = 'default';

type LessonSeed = {
  title: string;
  type: string;
  durationSec: number;
  body: string;
};

type ModuleSeed = {
  title: string;
  lessons: LessonSeed[];
};

type CourseSeed = {
  slug: string;
  title: string;
  description: string;
  category: { name: string; slug: string };
  modules: ModuleSeed[];
};

const DEMO_COURSES: CourseSeed[] = [
  {
    slug: 'workplace-safety-essentials',
    title: 'Workplace Safety Essentials',
    description:
      'A practical introduction to staying safe at work: hazard awareness, emergency procedures, and everyday safe practices every employee should know.',
    category: { name: 'Health & Safety', slug: 'health-safety' },
    modules: [
      {
        title: 'Getting Started with Safety',
        lessons: [
          {
            title: 'Why Workplace Safety Matters',
            type: 'text',
            durationSec: 300,
            body: [
              'Workplace safety protects you, your colleagues, and the organization.',
              '',
              'In this lesson you will learn:',
              '- The real cost of accidents, both human and financial.',
              '- How a strong safety culture prevents incidents before they happen.',
              '- Your personal responsibility in keeping the workplace safe.',
              '',
              'Key idea: most incidents are preventable. Reporting near-misses early is one of the most effective ways to stop a serious accident later.',
            ].join('\n'),
          },
          {
            title: 'Identifying Common Hazards',
            type: 'text',
            durationSec: 420,
            body: [
              'A hazard is anything with the potential to cause harm.',
              '',
              'Common workplace hazards include:',
              '1. Slips, trips, and falls (wet floors, trailing cables).',
              '2. Manual handling (lifting heavy or awkward loads).',
              '3. Electrical hazards (damaged cords, overloaded sockets).',
              '4. Fire (blocked exits, faulty equipment).',
              '',
              'Practice: walk through your own work area and list three hazards you can see right now. Then note one action to reduce each one.',
            ].join('\n'),
          },
        ],
      },
      {
        title: 'Responding to Emergencies',
        lessons: [
          {
            title: 'Emergency Procedures and Evacuation',
            type: 'text',
            durationSec: 480,
            body: [
              'When an emergency happens, calm and prepared people save lives.',
              '',
              'The basics:',
              '- Know your nearest two exits from any room you work in.',
              '- Know the location of the assembly point.',
              '- Never use lifts during a fire evacuation.',
              '- Help others who may need assistance, if it is safe to do so.',
              '',
              'Remember the order: raise the alarm, get to safety, then call for help once clear of danger.',
            ].join('\n'),
          },
          {
            title: 'First Aid Fundamentals',
            type: 'text',
            durationSec: 360,
            body: [
              'You are not expected to be a medic, but basic awareness helps.',
              '',
              'Three steps anyone can take:',
              '1. Check for danger before approaching.',
              '2. Call your designated first aider or emergency services.',
              '3. Stay with the person and reassure them until help arrives.',
              '',
              'Knowing where the first aid kit and the nearest first aider sit is half the battle.',
            ].join('\n'),
          },
          {
            title: 'Course Wrap-up and Next Steps',
            type: 'text',
            durationSec: 240,
            body: [
              'Well done for completing Workplace Safety Essentials.',
              '',
              'You should now be able to:',
              '- Recognize everyday hazards.',
              '- React correctly in an emergency.',
              '- Take simple first-aid-aware actions.',
              '',
              'Next step: review your team-specific safety guide and confirm your evacuation route this week.',
            ].join('\n'),
          },
        ],
      },
    ],
  },
  {
    slug: 'effective-communication-at-work',
    title: 'Effective Communication at Work',
    description:
      'Build the everyday communication skills that make teams work: clear writing, active listening, and giving feedback that actually helps.',
    category: { name: 'Professional Skills', slug: 'professional-skills' },
    modules: [
      {
        title: 'Foundations of Communication',
        lessons: [
          {
            title: 'The Communication Model',
            type: 'text',
            durationSec: 300,
            body: [
              'Every message has a sender, a channel, and a receiver.',
              '',
              'Communication breaks down when:',
              '- The message is unclear or overloaded with detail.',
              '- The wrong channel is used (a long policy over chat, for example).',
              '- The receiver is distracted or makes assumptions.',
              '',
              'Goal of this course: help you send clearer messages and receive them more accurately.',
            ].join('\n'),
          },
          {
            title: 'Active Listening',
            type: 'text',
            durationSec: 360,
            body: [
              'Listening is not waiting for your turn to talk.',
              '',
              'Active listening techniques:',
              '1. Give your full attention; put the phone away.',
              '2. Paraphrase what you heard to confirm understanding.',
              '3. Ask open questions to draw out detail.',
              '4. Hold judgment until the speaker finishes.',
              '',
              'Try it: in your next conversation, summarize the other person\u2019s point before responding.',
            ].join('\n'),
          },
        ],
      },
      {
        title: 'Communicating in Practice',
        lessons: [
          {
            title: 'Writing Clear Emails and Messages',
            type: 'text',
            durationSec: 420,
            body: [
              'Clear written communication saves everyone time.',
              '',
              'A reliable structure:',
              '- Subject line that states the purpose.',
              '- First line: what you need and by when.',
              '- Body: the supporting detail, in short paragraphs or bullets.',
              '- Close: a clear call to action.',
              '',
              'Rule of thumb: if a message takes more than a minute to read, consider a call instead.',
            ].join('\n'),
          },
          {
            title: 'Giving and Receiving Feedback',
            type: 'text',
            durationSec: 480,
            body: [
              'Good feedback is specific, timely, and kind.',
              '',
              'A simple framework (SBI):',
              '- Situation: describe when and where.',
              '- Behavior: describe what was done, factually.',
              '- Impact: explain the effect it had.',
              '',
              'When receiving feedback, listen fully, thank the person, and ask for one concrete suggestion to improve.',
            ].join('\n'),
          },
          {
            title: 'Putting It All Together',
            type: 'text',
            durationSec: 240,
            body: [
              'You now have a toolkit for clearer communication.',
              '',
              'Recap:',
              '- Match your message to the right channel.',
              '- Listen actively before responding.',
              '- Write with structure and a clear ask.',
              '- Give feedback using Situation\u2013Behavior\u2013Impact.',
              '',
              'Pick one technique to practice deliberately for the next week.',
            ].join('\n'),
          },
        ],
      },
    ],
  },
];

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
    console.log('▸ Seeding demo courses...');

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: TENANT_SUBDOMAIN },
    });

    if (!tenant) {
      console.error(
        `FATAL: tenant "${TENANT_SUBDOMAIN}" not found. Run the tenant seed first (npm run validate:seed or seed-tenant).`,
      );
      process.exit(1);
    }

    // Pick a course owner: prefer an instructor/admin, else any active user.
    const owner =
      (await prisma.user.findFirst({
        where: { tenantId: tenant.id, isActive: true, roles: { has: 'instructor' } },
      })) ??
      (await prisma.user.findFirst({
        where: { tenantId: tenant.id, isActive: true, roles: { has: 'admin' } },
      })) ??
      (await prisma.user.findFirst({
        where: { tenantId: tenant.id, isActive: true },
      }));

    if (!owner) {
      console.error(
        'FATAL: no active user found in the default tenant to own the demo courses. Seed users first.',
      );
      process.exit(1);
    }

    console.log(`  Using owner: ${owner.email}`);

    for (const courseSeed of DEMO_COURSES) {
      // Category (idempotent on tenantId+slug).
      const category = await prisma.category.upsert({
        where: {
          tenantId_slug: { tenantId: tenant.id, slug: courseSeed.category.slug },
        },
        create: {
          tenantId: tenant.id,
          name: courseSeed.category.name,
          slug: courseSeed.category.slug,
        },
        update: { name: courseSeed.category.name },
      });

      // Course (idempotent on tenantId+slug), force-published.
      const existing = await prisma.course.findUnique({
        where: { tenantId_slug: { tenantId: tenant.id, slug: courseSeed.slug } },
      });

      const course = existing
        ? await prisma.course.update({
            where: { id: existing.id },
            data: {
              title: courseSeed.title,
              description: courseSeed.description,
              status: 'published',
              visibility: 'public',
              categoryId: category.id,
            },
          })
        : await prisma.course.create({
            data: {
              tenantId: tenant.id,
              title: courseSeed.title,
              slug: courseSeed.slug,
              description: courseSeed.description,
              status: 'published',
              visibility: 'public',
              categoryId: category.id,
              createdById: owner.id,
            },
          });

      // Rebuild the module/lesson tree deterministically. Deleting modules
      // cascades to lessons; enrollments are preserved (separate relation),
      // and progress rows are keyed on lessons so they reset cleanly for a
      // freshly rebuilt demo tree.
      await prisma.courseModule.deleteMany({ where: { courseId: course.id } });

      let moduleOrder = 1;
      for (const moduleSeed of courseSeed.modules) {
        const mod = await prisma.courseModule.create({
          data: {
            courseId: course.id,
            title: moduleSeed.title,
            order: moduleOrder,
          },
        });

        let lessonOrder = 1;
        for (const lessonSeed of moduleSeed.lessons) {
          await prisma.lesson.create({
            data: {
              moduleId: mod.id,
              title: lessonSeed.title,
              type: lessonSeed.type,
              order: lessonOrder,
              duration: lessonSeed.durationSec,
              content: { body: lessonSeed.body },
            },
          });
          lessonOrder++;
        }
        moduleOrder++;
      }

      const moduleCount = courseSeed.modules.length;
      const lessonCount = courseSeed.modules.reduce(
        (sum, m) => sum + m.lessons.length,
        0,
      );
      console.log(
        `  ✓ ${courseSeed.title} — ${moduleCount} modules, ${lessonCount} lessons (published)`,
      );
    }

    // Task requirement: keep only the 2 demo courses visible in the catalog
    // for now. Demote any OTHER currently-published course in this tenant to
    // `draft` (reversible, non-destructive — enrollments and content stay
    // intact and they can be re-published from the instructor editor).
    const demoSlugs = DEMO_COURSES.map((c) => c.slug);
    const demoted = await prisma.course.updateMany({
      where: {
        tenantId: tenant.id,
        status: 'published',
        slug: { notIn: demoSlugs },
      },
      data: { status: 'draft' },
    });
    if (demoted.count > 0) {
      console.log(
        `  ↩ Demoted ${demoted.count} other published course(s) to draft so the catalog shows only the 2 demo courses.`,
      );
    }

    console.log('Demo course seed complete. Catalog now has 2 published courses.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Demo seed failed:', error);
  process.exit(1);
});
