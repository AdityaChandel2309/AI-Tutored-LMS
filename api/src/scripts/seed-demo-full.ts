/**
 * Rich per-role demo seed.
 *
 * Populates the `default` tenant so every major feature shows realistic
 * content on login. Idempotent — safe to re-run; upserts by natural keys.
 *
 * Usage (from api/):
 *   npm run seed:demo
 *   npm run seed:demo -- --reset   (wipes demo-owned artifacts first)
 *
 * Assumes seed-tenant.ts and seed-users.ts have already run so the default
 * tenant plus the 4 demo users (admin/instructor/learner/super.admin) exist.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadProjectEnv } from '../env';

loadProjectEnv();

const TENANT_SUBDOMAIN = 'default';
const DEMO_TAG = 'demo';

type LessonSeed = {
  title: string;
  type: 'text' | 'video' | 'quiz';
  durationSec: number;
  body?: string;
  quiz?: QuizSeed;
};

type ModuleSeed = { title: string; lessons: LessonSeed[] };

type QuestionSeed = {
  text: string;
  type: 'multiple_choice' | 'multi_select' | 'true_false';
  options: { text: string; isCorrect: boolean }[];
  explanation?: string;
};

type QuizSeed = {
  title: string;
  passingScore: number;
  questions: QuestionSeed[];
};

type CourseSeed = {
  slug: string;
  title: string;
  description: string;
  category: { name: string; slug: string };
  ownerEmail?: string; // defaults to instructor
  modules: ModuleSeed[];
};

// ─── Course library ──────────────────────────────────

const finalQuiz = (topic: string): QuizSeed => ({
  title: `${topic} — Final Assessment`,
  passingScore: 70,
  questions: [
    {
      text: `Which statement best describes the core purpose of ${topic}?`,
      type: 'multiple_choice',
      options: [
        { text: 'It is only a legal formality.', isCorrect: false },
        { text: 'It reduces risk and improves outcomes for everyone involved.', isCorrect: true },
        { text: 'It applies only to managers.', isCorrect: false },
        { text: 'It is optional in most workplaces.', isCorrect: false },
      ],
      explanation: `${topic} exists to reduce risk and improve outcomes.`,
    },
    {
      text: `Everyone shares responsibility for ${topic} at work.`,
      type: 'true_false',
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },
    {
      text: `Select all practices that support strong ${topic}.`,
      type: 'multi_select',
      options: [
        { text: 'Reporting issues early', isCorrect: true },
        { text: 'Following documented procedures', isCorrect: true },
        { text: 'Ignoring near-misses', isCorrect: false },
        { text: 'Sharing knowledge with the team', isCorrect: true },
      ],
    },
    {
      text: `A colleague notices a problem related to ${topic}. What should they do first?`,
      type: 'multiple_choice',
      options: [
        { text: 'Wait and hope it resolves itself.', isCorrect: false },
        { text: 'Report it through the correct channel.', isCorrect: true },
        { text: 'Only mention it in the next quarterly review.', isCorrect: false },
        { text: 'Post about it publicly on social media.', isCorrect: false },
      ],
    },
    {
      text: `Documentation and training are optional for ${topic}.`,
      type: 'true_false',
      options: [
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: true },
      ],
    },
  ],
});

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
            body: 'Workplace safety protects you, your colleagues, and the organization. Most incidents are preventable — reporting near-misses early is one of the most effective ways to stop a serious accident later.',
          },
          {
            title: 'Identifying Common Hazards',
            type: 'text',
            durationSec: 420,
            body: 'Common hazards: slips and trips, manual handling, electrical, and fire. Walk through your area and list three you can see right now.',
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
            body: 'Know your two nearest exits, your assembly point, and never use lifts in a fire evacuation.',
          },
          {
            title: 'Final Assessment',
            type: 'quiz',
            durationSec: 600,
            quiz: finalQuiz('workplace safety'),
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
          { title: 'The Communication Model', type: 'text', durationSec: 300, body: 'Every message has a sender, a channel, and a receiver. Match the channel to the message.' },
          { title: 'Active Listening', type: 'text', durationSec: 360, body: 'Listening is not waiting for your turn to talk. Paraphrase to confirm understanding.' },
        ],
      },
      {
        title: 'Communicating in Practice',
        lessons: [
          { title: 'Writing Clear Emails and Messages', type: 'text', durationSec: 420, body: 'Subject states purpose. First line = the ask. Body = supporting detail. Close = clear CTA.' },
          { title: 'Giving and Receiving Feedback (SBI)', type: 'text', durationSec: 480, body: 'Situation — Behavior — Impact. Specific, timely, and kind.' },
          { title: 'Final Assessment', type: 'quiz', durationSec: 600, quiz: finalQuiz('effective communication') },
        ],
      },
    ],
  },
  {
    slug: 'data-privacy-and-gdpr',
    title: 'Data Privacy & GDPR Fundamentals',
    description:
      'Understand what personal data is, how to handle it lawfully, and what to do when things go wrong. Practical GDPR knowledge for every team.',
    category: { name: 'Compliance', slug: 'compliance' },
    modules: [
      {
        title: 'GDPR Basics',
        lessons: [
          { title: 'What is Personal Data?', type: 'text', durationSec: 300, body: 'Any information that can identify a living individual — directly or in combination.' },
          { title: 'The Six Lawful Bases', type: 'text', durationSec: 420, body: 'Consent, contract, legal obligation, vital interests, public task, legitimate interests.' },
        ],
      },
      {
        title: 'In Practice',
        lessons: [
          { title: 'Data Subject Rights', type: 'text', durationSec: 360, body: 'Right to be informed, access, rectification, erasure, restriction, portability, objection, and rights around automated decisions.' },
          { title: 'Breach Response', type: 'text', durationSec: 300, body: '72-hour reporting window. Contain, assess, notify, remediate.' },
          { title: 'Final Assessment', type: 'quiz', durationSec: 600, quiz: finalQuiz('data privacy') },
        ],
      },
    ],
  },
  {
    slug: 'fire-safety-drill',
    title: 'Fire Safety & Evacuation Drill',
    description:
      'Recognize fire risks, use the right extinguisher for the right fire, and evacuate safely. Includes an assessed checklist.',
    category: { name: 'Health & Safety', slug: 'health-safety' },
    modules: [
      {
        title: 'Understanding Fire',
        lessons: [
          { title: 'The Fire Triangle', type: 'text', durationSec: 240, body: 'Heat + fuel + oxygen. Remove one to break the fire.' },
          { title: 'Extinguisher Types', type: 'text', durationSec: 360, body: 'Water, foam, CO2, dry powder, wet chemical — each matched to a fire class.' },
        ],
      },
      {
        title: 'Evacuation',
        lessons: [
          { title: 'Assembly Point Protocol', type: 'text', durationSec: 300, body: 'Leave calmly, close doors behind you, do not return for belongings.' },
          { title: 'Final Assessment', type: 'quiz', durationSec: 600, quiz: finalQuiz('fire safety') },
        ],
      },
    ],
  },
  {
    slug: 'excel-for-analysts',
    title: 'Excel for Analysts',
    description:
      'Move beyond basic formulas — pivot tables, XLOOKUP, dynamic arrays, and dashboards that stakeholders can actually read.',
    category: { name: 'Technical', slug: 'technical' },
    modules: [
      {
        title: 'Modern Formulas',
        lessons: [
          { title: 'XLOOKUP vs VLOOKUP', type: 'text', durationSec: 360, body: 'XLOOKUP handles left-lookup, exact match by default, and returns arrays.' },
          { title: 'Dynamic Arrays (FILTER, SORT, UNIQUE)', type: 'text', durationSec: 420, body: 'Spill ranges let one formula power an entire report.' },
        ],
      },
      {
        title: 'Analysis at Scale',
        lessons: [
          { title: 'Pivot Tables & Slicers', type: 'text', durationSec: 480, body: 'Pivot to summarize, slice to filter interactively.' },
          { title: 'Dashboard Design', type: 'text', durationSec: 420, body: 'Chart what changes decisions; hide chart junk; align to a grid.' },
          { title: 'Final Assessment', type: 'quiz', durationSec: 600, quiz: finalQuiz('spreadsheet analysis') },
        ],
      },
    ],
  },
  {
    slug: 'leading-remote-teams',
    title: 'Leading Remote Teams',
    description:
      'Rituals, tools, and habits that keep distributed teams aligned, motivated, and shipping.',
    category: { name: 'Leadership', slug: 'leadership' },
    modules: [
      {
        title: 'Foundations',
        lessons: [
          { title: 'Trust in a Remote Team', type: 'text', durationSec: 360, body: 'Trust is built by clarity of expectations, reliability of follow-through, and psychological safety.' },
          { title: 'Async vs Sync', type: 'text', durationSec: 300, body: 'Default to async. Use sync for decisions, disagreements, and celebrations.' },
        ],
      },
      {
        title: 'In Practice',
        lessons: [
          { title: '1:1s That Actually Help', type: 'text', durationSec: 360, body: 'Their agenda first. Career + wellbeing + work. Notes shared afterwards.' },
          { title: 'Final Assessment', type: 'quiz', durationSec: 600, quiz: finalQuiz('remote leadership') },
        ],
      },
    ],
  },
  {
    slug: 'new-hire-onboarding',
    title: 'New Hire Onboarding',
    description:
      'Your first 30 days: meet the company, set up your tools, and know where to find help.',
    category: { name: 'Onboarding', slug: 'onboarding' },
    modules: [
      {
        title: 'Week 1',
        lessons: [
          { title: 'Welcome & Company Values', type: 'text', durationSec: 300, body: 'Meet the mission, values, and the people behind them.' },
          { title: 'Your Tools & Access', type: 'text', durationSec: 240, body: 'Email, chat, VPN, HRIS, LMS. If something is missing, ping IT.' },
        ],
      },
      {
        title: 'Weeks 2–4',
        lessons: [
          { title: 'Meet Your Team', type: 'text', durationSec: 300, body: 'Schedule 15-min intros with everyone on your immediate team.' },
          { title: 'Your First Project', type: 'text', durationSec: 360, body: 'A small, well-scoped ticket. Ask for a code/process review early.' },
          { title: 'Final Assessment', type: 'quiz', durationSec: 600, quiz: finalQuiz('onboarding') },
        ],
      },
    ],
  },
];

// ─── Ownership per course (rotates instructor + super.admin) ─────

function ownerForCourse(index: number, instructorId: string, superAdminId: string) {
  // First 5 by instructor, last 2 by super admin to give both authorship
  return index < 5 ? instructorId : superAdminId;
}

// ─── Departments / designations ──────────────────────

const DEPARTMENTS = [
  { code: 'OPS', name: 'Operations' },
  { code: 'ENG', name: 'Engineering' },
  { code: 'HR', name: 'People & Culture' },
];

const DESIGNATIONS = [
  { name: 'Engineer', level: 1 },
  { name: 'Senior Engineer', level: 2 },
  { name: 'Team Lead', level: 3 },
  { name: 'Manager', level: 4 },
  { name: 'Director', level: 5 },
  { name: 'Analyst', level: 1 },
];

// ─── Synthetic team members (DB-only, no Keycloak) ────

const SYNTHETIC_TEAM = [
  { email: 'sam.rivera@lms.dev', firstName: 'Sam', lastName: 'Rivera' },
  { email: 'priya.iyer@lms.dev', firstName: 'Priya', lastName: 'Iyer' },
  { email: 'liam.chen@lms.dev', firstName: 'Liam', lastName: 'Chen' },
  { email: 'nadia.osei@lms.dev', firstName: 'Nadia', lastName: 'Osei' },
];

// ─── Knowledge base sample docs ──────────────────────

const DEMO_DOCS = [
  {
    title: 'Employee Handbook',
    fileName: 'employee-handbook.pdf',
    type: 'policy',
    tags: ['handbook', 'policy'],
    body: 'This handbook outlines company values, working hours, leave policy, remote-work expectations, code of conduct, and escalation channels. All employees are expected to read it during their first week.',
  },
  {
    title: 'Workplace Safety Policy',
    fileName: 'safety-policy.pdf',
    type: 'policy',
    tags: ['safety', 'health'],
    body: 'Every employee is responsible for maintaining a safe workplace. Report hazards immediately through the safety channel. Fire drills are conducted quarterly. First-aiders are listed on each floor.',
  },
  {
    title: 'Onboarding Checklist',
    fileName: 'onboarding-checklist.md',
    type: 'guide',
    tags: ['onboarding', 'checklist'],
    body: 'Day 1: laptop, accounts, buddy assignment. Week 1: team intros, first ticket. Month 1: 30-day check-in with manager and HR.',
  },
  {
    title: 'Code of Conduct',
    fileName: 'code-of-conduct.pdf',
    type: 'policy',
    tags: ['conduct', 'ethics'],
    body: 'We treat each other with respect. Harassment, discrimination, and retaliation are not tolerated. Concerns can be raised confidentially through the People & Culture team.',
  },
];

// ─── Projects ────────────────────────────────────────

const DEMO_PROJECTS = [
  {
    title: 'LMS 2.0 Launch',
    description: 'Ship the new learner experience, migrated analytics, and certificate PDFs.',
    status: 'in_progress',
    departmentCode: 'ENG',
    milestones: [
      { title: 'RAG upgrade shipped', status: 'completed' },
      { title: 'Assessments UI GA', status: 'in_progress' },
      { title: 'Analytics dashboards GA', status: 'pending' },
    ],
  },
  {
    title: 'Q3 Safety Recertification',
    description: 'Roll out fire safety refresh to all field teams before Q3 close.',
    status: 'in_progress',
    departmentCode: 'OPS',
    milestones: [
      { title: 'Content updated', status: 'completed' },
      { title: 'All learners enrolled', status: 'in_progress' },
      { title: '100% completion', status: 'pending' },
    ],
  },
  {
    title: 'New Hire Onboarding Refresh',
    description: 'Redesign the first-30-days experience with a buddy program.',
    status: 'planning',
    departmentCode: 'HR',
    milestones: [
      { title: 'Interviews with recent hires', status: 'in_progress' },
      { title: 'Buddy program pilot', status: 'pending' },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────

function certNumber(): string {
  return `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const shouldReset = process.argv.includes('--reset');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await prisma.$connect();

  try {
    console.log('▸ Rich demo seed starting…');

    const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
    if (!tenant) {
      throw new Error(`Tenant "${TENANT_SUBDOMAIN}" not found. Run seed-tenant.ts first.`);
    }

    // Resolve demo users by email; require the primary four.
    const users = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        email: { in: ['admin@lms.dev', 'instructor@lms.dev', 'learner@lms.dev', 'super.admin@lms.dev'] },
      },
    });
    const byEmail = new Map(users.map((u) => [u.email, u]));
    const admin = byEmail.get('admin@lms.dev');
    const instructor = byEmail.get('instructor@lms.dev');
    const learner = byEmail.get('learner@lms.dev');
    const superAdmin = byEmail.get('super.admin@lms.dev');
    if (!admin || !instructor || !learner || !superAdmin) {
      throw new Error('Demo users missing. Run seed-users.ts first (needs admin/instructor/learner/super.admin@lms.dev).');
    }
    // super.admin doubles as the demo "manager" persona.
    const manager = superAdmin;

    if (shouldReset) {
      console.log('  ⟲ --reset: removing existing demo courses, projects, docs, notifications…');
      const slugs = DEMO_COURSES.map((c) => c.slug);
      await prisma.course.deleteMany({ where: { tenantId: tenant.id, slug: { in: slugs } } });
      await prisma.project.deleteMany({ where: { tenantId: tenant.id, title: { in: DEMO_PROJECTS.map((p) => p.title) } } });
      await prisma.document.deleteMany({ where: { tenantId: tenant.id, title: { in: DEMO_DOCS.map((d) => d.title) } } });
      await prisma.notification.deleteMany({ where: { tenantId: tenant.id, metadata: { path: ['source'], equals: DEMO_TAG } } });
    }

    // ── Departments ──────────────────────────
    console.log('  • Departments & designations');
    const deptByCode = new Map<string, string>();
    for (const d of DEPARTMENTS) {
      const row = await prisma.department.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: d.code } },
        create: { tenantId: tenant.id, code: d.code, name: d.name, managerId: manager.id },
        update: { name: d.name, managerId: manager.id },
      });
      deptByCode.set(d.code, row.id);
    }

    // Designations
    const desigByName = new Map<string, string>();
    for (const ds of DESIGNATIONS) {
      const row = await prisma.designation.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: ds.name } },
        create: { tenantId: tenant.id, name: ds.name, level: ds.level },
        update: { level: ds.level },
      });
      desigByName.set(ds.name, row.id);
    }

    // ── Employee profiles for demo users ─────
    const profiles: {
      userId: string;
      code: string;
      dept: string;
      desig: string;
      manager?: string;
    }[] = [
      { userId: admin.id, code: 'E-ADM-001', dept: 'HR', desig: 'Director' },
      { userId: manager.id, code: 'E-MGR-001', dept: 'ENG', desig: 'Manager' },
      { userId: instructor.id, code: 'E-INS-001', dept: 'ENG', desig: 'Senior Engineer', manager: manager.id },
      { userId: learner.id, code: 'E-LRN-001', dept: 'OPS', desig: 'Analyst', manager: manager.id },
    ];
    for (const p of profiles) {
      await prisma.employeeProfile.upsert({
        where: { userId: p.userId },
        create: {
          userId: p.userId,
          tenantId: tenant.id,
          employeeCode: p.code,
          departmentId: deptByCode.get(p.dept),
          designationId: desigByName.get(p.desig),
          reportingManagerId: p.manager,
          dateOfJoining: new Date('2024-01-15'),
          location: 'Remote',
        },
        update: {
          employeeCode: p.code,
          departmentId: deptByCode.get(p.dept),
          designationId: desigByName.get(p.desig),
          reportingManagerId: p.manager,
        },
      });
    }

    // ── Synthetic team (DB-only) reporting to manager ──
    console.log('  • Synthetic team members (DB-only)');
    const syntheticUsers: { id: string; email: string; firstName: string; lastName: string }[] = [];
    for (const [i, s] of SYNTHETIC_TEAM.entries()) {
      // Deterministic fake keycloakId so upsert is idempotent.
      const keycloakId = `synthetic-${s.email}`;
      const u = await prisma.user.upsert({
        where: { keycloakId },
        create: {
          keycloakId,
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          roles: ['learner', 'employee'],
          isActive: true,
          tenantId: tenant.id,
        },
        update: { firstName: s.firstName, lastName: s.lastName, tenantId: tenant.id, isActive: true },
      });
      syntheticUsers.push({ id: u.id, email: u.email, firstName: s.firstName, lastName: s.lastName });
      await prisma.employeeProfile.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          tenantId: tenant.id,
          employeeCode: `E-TM-${(i + 1).toString().padStart(3, '0')}`,
          departmentId: deptByCode.get(i % 2 === 0 ? 'OPS' : 'ENG'),
          designationId: desigByName.get('Engineer'),
          reportingManagerId: manager.id,
          dateOfJoining: new Date('2024-06-01'),
          location: 'Remote',
        },
        update: { reportingManagerId: manager.id },
      });
    }

    // ── Courses ──────────────────────────────
    console.log('  • Courses, modules, lessons, assessments, cert templates');
    const catCache = new Map<string, string>();
    const courseIdBySlug = new Map<string, string>();

    for (const [index, seed] of DEMO_COURSES.entries()) {
      // Category
      let categoryId = catCache.get(seed.category.slug);
      if (!categoryId) {
        const cat = await prisma.category.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: seed.category.slug } },
          create: { tenantId: tenant.id, name: seed.category.name, slug: seed.category.slug },
          update: { name: seed.category.name },
        });
        categoryId = cat.id;
        catCache.set(seed.category.slug, categoryId);
      }

      const ownerId = ownerForCourse(index, instructor.id, superAdmin.id);

      const existing = await prisma.course.findUnique({
        where: { tenantId_slug: { tenantId: tenant.id, slug: seed.slug } },
      });

      const course = existing
        ? await prisma.course.update({
            where: { id: existing.id },
            data: {
              title: seed.title,
              description: seed.description,
              status: 'published',
              visibility: 'public',
              categoryId,
            },
          })
        : await prisma.course.create({
            data: {
              tenantId: tenant.id,
              title: seed.title,
              slug: seed.slug,
              description: seed.description,
              status: 'published',
              visibility: 'public',
              categoryId,
              createdById: ownerId,
            },
          });
      courseIdBySlug.set(seed.slug, course.id);

      // Wipe & rebuild module tree
      await prisma.courseModule.deleteMany({ where: { courseId: course.id } });

      let mOrder = 1;
      for (const m of seed.modules) {
        const mod = await prisma.courseModule.create({
          data: { courseId: course.id, title: m.title, order: mOrder++ },
        });
        let lOrder = 1;
        for (const l of m.lessons) {
          const lesson = await prisma.lesson.create({
            data: {
              moduleId: mod.id,
              title: l.title,
              type: l.type,
              order: lOrder++,
              duration: l.durationSec,
              content: l.type === 'text' ? { body: l.body ?? '' } : Prisma.JsonNull,
            },
          });
          if (l.type === 'quiz' && l.quiz) {
            const assessment = await prisma.assessment.create({
              data: {
                lessonId: lesson.id,
                title: l.quiz.title,
                passingScore: l.quiz.passingScore,
              },
            });
            let qOrder = 1;
            for (const q of l.quiz.questions) {
              const question = await prisma.question.create({
                data: {
                  assessmentId: assessment.id,
                  type: q.type,
                  text: q.text,
                  explanation: q.explanation,
                  order: qOrder++,
                },
              });
              let optOrder = 1;
              for (const o of q.options) {
                await prisma.questionOption.create({
                  data: {
                    questionId: question.id,
                    text: o.text,
                    isCorrect: o.isCorrect,
                    order: optOrder++,
                  },
                });
              }
            }
          }
        }
      }

      // Certificate template
      await prisma.certificateTemplate.upsert({
        where: { courseId: course.id },
        create: {
          tenantId: tenant.id,
          courseId: course.id,
          title: `${seed.title} — Certificate of Completion`,
          description: `Awarded on successful completion of "${seed.title}".`,
          isActive: true,
        },
        update: { isActive: true },
      });
    }

    // Demote any OTHER published course in this tenant to draft, matching seed-demo-courses behavior.
    const demoSlugs = DEMO_COURSES.map((c) => c.slug);
    await prisma.course.updateMany({
      where: { tenantId: tenant.id, status: 'published', slug: { notIn: demoSlugs } },
      data: { status: 'draft' },
    });

    // ── Enrollments + progress + attempts + certs ──
    console.log('  • Enrollments, progress, attempts, certificates');

    async function enroll(userId: string, courseSlug: string, opts: {
      progressPct: number;
      completeQuiz?: 'pass' | 'fail' | 'none';
      issueCert?: boolean;
      learnerName: string;
    }) {
      const courseId = courseIdBySlug.get(courseSlug);
      if (!courseId) return;
      const enrollment = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: {
          userId,
          courseId,
          progress: opts.progressPct,
          completedAt: opts.progressPct >= 100 ? new Date() : null,
        },
        update: {
          progress: opts.progressPct,
          completedAt: opts.progressPct >= 100 ? new Date() : null,
        },
      });

      // Progress rows
      const lessons = await prisma.lesson.findMany({
        where: { module: { courseId } },
        orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      });
      const completeCount = Math.round((opts.progressPct / 100) * lessons.length);
      for (const [i, lesson] of lessons.entries()) {
        const state = i < completeCount ? 'completed' : i === completeCount ? 'in_progress' : 'not_started';
        await prisma.progress.upsert({
          where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
          create: {
            enrollmentId: enrollment.id,
            lessonId: lesson.id,
            state,
            progress: state === 'completed' ? 100 : state === 'in_progress' ? 40 : 0,
            startedAt: state !== 'not_started' ? new Date() : null,
            completedAt: state === 'completed' ? new Date() : null,
          },
          update: {
            state,
            progress: state === 'completed' ? 100 : state === 'in_progress' ? 40 : 0,
            completedAt: state === 'completed' ? new Date() : null,
          },
        });
      }

      // Quiz attempt (if course has one and we asked for it)
      if (opts.completeQuiz && opts.completeQuiz !== 'none') {
        const quizLesson = lessons.find((l) => l.type === 'quiz');
        if (quizLesson) {
          const assessment = await prisma.assessment.findUnique({ where: { lessonId: quizLesson.id } });
          if (assessment) {
            const passed = opts.completeQuiz === 'pass';
            const score = passed ? 85 : 45;
            await prisma.assessmentAttempt.upsert({
              where: {
                assessmentId_enrollmentId_attemptNumber: {
                  assessmentId: assessment.id,
                  enrollmentId: enrollment.id,
                  attemptNumber: 1,
                },
              },
              create: {
                assessmentId: assessment.id,
                enrollmentId: enrollment.id,
                attemptNumber: 1,
                score,
                passed,
                submittedAt: new Date(),
                durationSec: 480,
              },
              update: { score, passed, submittedAt: new Date() },
            });
          }
        }
      }

      // Certificate
      if (opts.issueCert) {
        const template = await prisma.certificateTemplate.findUnique({ where: { courseId } });
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (template && course) {
          await prisma.issuedCertificate.upsert({
            where: {
              templateId_enrollmentId: {
                templateId: template.id,
                enrollmentId: enrollment.id,
              },
            },
            create: {
              templateId: template.id,
              enrollmentId: enrollment.id,
              userId,
              tenantId: tenant.id,
              certificateNumber: certNumber(),
              learnerName: opts.learnerName,
              courseTitle: course.title,
              completionDate: new Date(),
              scoreSummary: 'Passed with distinction',
            },
            update: { learnerName: opts.learnerName, completionDate: new Date() },
          });
        }
      }
    }

    const learnerName = `${learner.firstName ?? ''} ${learner.lastName ?? ''}`.trim() || learner.email;
    // Learner: 2 completed + certs, 2 in progress, 1 not started
    await enroll(learner.id, 'workplace-safety-essentials', { progressPct: 100, completeQuiz: 'pass', issueCert: true, learnerName });
    await enroll(learner.id, 'effective-communication-at-work', { progressPct: 100, completeQuiz: 'pass', issueCert: true, learnerName });
    await enroll(learner.id, 'data-privacy-and-gdpr', { progressPct: 65, completeQuiz: 'none', learnerName });
    await enroll(learner.id, 'new-hire-onboarding', { progressPct: 30, completeQuiz: 'none', learnerName });
    await enroll(learner.id, 'excel-for-analysts', { progressPct: 0, completeQuiz: 'none', learnerName });

    const instructorName = `${instructor.firstName ?? ''} ${instructor.lastName ?? ''}`.trim() || instructor.email;
    await enroll(instructor.id, 'leading-remote-teams', { progressPct: 100, completeQuiz: 'pass', issueCert: true, learnerName: instructorName });

    const managerName = `${manager.firstName ?? ''} ${manager.lastName ?? ''}`.trim() || manager.email;
    await enroll(manager.id, 'leading-remote-teams', { progressPct: 100, completeQuiz: 'pass', issueCert: true, learnerName: managerName });
    await enroll(manager.id, 'data-privacy-and-gdpr', { progressPct: 50, completeQuiz: 'none', learnerName: managerName });

    const adminName = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || admin.email;
    await enroll(admin.id, 'workplace-safety-essentials', { progressPct: 40, completeQuiz: 'none', learnerName: adminName });

    // Synthetic team: spread across courses with varied progress for analytics
    const spread: { slug: string; pct: number; complete?: boolean }[] = [
      { slug: 'workplace-safety-essentials', pct: 100, complete: true },
      { slug: 'fire-safety-drill', pct: 75 },
      { slug: 'data-privacy-and-gdpr', pct: 100, complete: true },
      { slug: 'excel-for-analysts', pct: 20 },
      { slug: 'effective-communication-at-work', pct: 60 },
      { slug: 'new-hire-onboarding', pct: 100, complete: true },
    ];
    for (const [i, u] of syntheticUsers.entries()) {
      const nm = `${u.firstName} ${u.lastName}`;
      // Each synthetic user gets 3 rotating courses
      for (let k = 0; k < 3; k++) {
        const s = spread[(i + k) % spread.length];
        await enroll(u.id, s.slug, {
          progressPct: s.pct,
          completeQuiz: s.complete ? 'pass' : 'none',
          issueCert: s.complete,
          learnerName: nm,
        });
      }
    }

    // ── Notifications ────────────────────────
    console.log('  • Notifications');
    async function notify(userId: string, entries: { type: string; title: string; body: string; isRead?: boolean }[]) {
      // Wipe and re-seed demo notifications for this user (tag via metadata).
      await prisma.notification.deleteMany({
        where: { userId, tenantId: tenant.id, metadata: { path: ['source'], equals: DEMO_TAG } },
      });
      for (const e of entries) {
        await prisma.notification.create({
          data: {
            userId,
            tenantId: tenant.id,
            type: e.type,
            title: e.title,
            body: e.body,
            isRead: e.isRead ?? false,
            readAt: e.isRead ? new Date() : null,
            metadata: { source: DEMO_TAG },
          },
        });
      }
    }
    await notify(learner.id, [
      { type: 'certificate_issued', title: 'Certificate issued', body: 'You earned a certificate for Workplace Safety Essentials.' },
      { type: 'enrollment', title: 'New course available', body: 'You have been enrolled in Data Privacy & GDPR.' },
      { type: 'quiz_result', title: 'Quiz passed', body: 'You scored 85% on Effective Communication.', isRead: true },
      { type: 'reminder', title: 'Keep learning', body: 'Continue New Hire Onboarding — 3 lessons remaining.' },
    ]);
    await notify(instructor.id, [
      { type: 'course_published', title: 'Course published', body: 'Leading Remote Teams is now live.' },
      { type: 'mention', title: 'Learner submitted quiz', body: 'A learner just completed your assessment.' },
      { type: 'review', title: 'Course review requested', body: 'Fire Safety Drill needs your review.', isRead: true },
    ]);
    await notify(manager.id, [
      { type: 'team_progress', title: 'Team update', body: '4 team members completed a course this week.' },
      { type: 'certificate_issued', title: 'Certificate issued', body: 'You earned a certificate for Leading Remote Teams.' },
      { type: 'reminder', title: 'Weekly 1:1s', body: 'Schedule this week\'s 1:1s with your reports.', isRead: true },
    ]);
    await notify(admin.id, [
      { type: 'audit', title: 'New user activity', body: '4 new team members were added to your organization.' },
      { type: 'system', title: 'Analytics ready', body: 'This week\'s learning analytics are available.' },
    ]);

    // ── Projects ─────────────────────────────
    console.log('  • Projects');
    for (const p of DEMO_PROJECTS) {
      const existing = await prisma.project.findFirst({
        where: { tenantId: tenant.id, title: p.title },
      });
      const project = existing
        ? await prisma.project.update({
            where: { id: existing.id },
            data: {
              description: p.description,
              status: p.status,
              departmentId: deptByCode.get(p.departmentCode),
              ownerId: manager.id,
              startDate: new Date('2026-01-15'),
              targetEndDate: new Date('2026-12-31'),
            },
          })
        : await prisma.project.create({
            data: {
              tenantId: tenant.id,
              title: p.title,
              description: p.description,
              status: p.status,
              departmentId: deptByCode.get(p.departmentCode),
              ownerId: manager.id,
              startDate: new Date('2026-01-15'),
              targetEndDate: new Date('2026-12-31'),
            },
          });
      await prisma.milestone.deleteMany({ where: { projectId: project.id } });
      let order = 1;
      for (const m of p.milestones) {
        await prisma.milestone.create({
          data: {
            projectId: project.id,
            title: m.title,
            status: m.status,
            order: order++,
            completedAt: m.status === 'completed' ? new Date() : null,
          },
        });
      }
      // Members: manager + instructor + a synthetic teammate
      const members = [
        { userId: manager.id, role: 'owner' },
        { userId: instructor.id, role: 'contributor' },
        { userId: syntheticUsers[0]?.id, role: 'member' },
      ].filter((m) => !!m.userId) as { userId: string; role: string }[];
      for (const m of members) {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: project.id, userId: m.userId } },
          create: { projectId: project.id, userId: m.userId, role: m.role },
          update: { role: m.role },
        });
      }
    }

    // ── Knowledge documents ──────────────────
    console.log('  • Knowledge base documents');
    const kbCat = await prisma.documentCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: 'policies' } },
      create: { tenantId: tenant.id, name: 'Policies & Guides', slug: 'policies' },
      update: { name: 'Policies & Guides' },
    });
    for (const d of DEMO_DOCS) {
      const existing = await prisma.document.findFirst({
        where: { tenantId: tenant.id, title: d.title },
      });
      const doc = existing
        ? await prisma.document.update({
            where: { id: existing.id },
            data: {
              description: d.body.slice(0, 200),
              type: d.type,
              tags: d.tags,
              status: 'published',
              categoryId: kbCat.id,
            },
          })
        : await prisma.document.create({
            data: {
              tenantId: tenant.id,
              categoryId: kbCat.id,
              title: d.title,
              description: d.body.slice(0, 200),
              type: d.type,
              tags: d.tags,
              status: 'published',
              fileName: d.fileName,
              fileObjectKey: `demo/${d.fileName}`,
              fileSize: d.body.length,
              mimeType: d.fileName.endsWith('.pdf') ? 'application/pdf' : 'text/markdown',
              uploadedById: admin.id,
            },
          });
      // Refresh chunk (no embedding — backfill:document-embeddings can add later)
      await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
      await prisma.documentChunk.create({
        data: {
          documentId: doc.id,
          tenantId: tenant.id,
          chunkIndex: 0,
          chunkText: `${d.title}\n\n${d.body}`,
          tokenCount: Math.ceil(d.body.length / 4),
        },
      });
    }

    // ── Audit log samples ────────────────────
    console.log('  • Audit log samples');
    const auditRows = [
      { actorId: admin.id, action: 'user.login', entityType: 'User', entityId: admin.id },
      { actorId: instructor.id, action: 'course.publish', entityType: 'Course', entityId: courseIdBySlug.get('leading-remote-teams') ?? null },
      { actorId: admin.id, action: 'certificate.issue', entityType: 'IssuedCertificate', entityId: null },
      { actorId: manager.id, action: 'user.login', entityType: 'User', entityId: manager.id },
    ];
    for (const a of auditRows) {
      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: a.actorId,
          action: a.action,
          entityType: a.entityType ?? null,
          entityId: a.entityId ?? null,
          metadata: { source: DEMO_TAG },
          ipAddress: '127.0.0.1',
        },
      });
    }

    console.log('\n✅ Rich demo seed complete.');
    console.log('   Log in as any of admin@lms.dev, instructor@lms.dev, learner@lms.dev, super.admin@lms.dev (password Admin@1234).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Rich demo seed failed:', e);
  process.exit(1);
});