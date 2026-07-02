/**
 * Full Platform Demo Seed
 * Populates ALL modules with realistic demo data:
 * - Organization (departments + designations)
 * - Employee profiles for all 4 users
 * - Projects with milestones + team members
 * - Knowledge document categories + stub documents
 * - Course categories (additional ones)
 * - Notifications for users
 *
 * Run with:
 *   cd api && npx ts-node -r tsconfig-paths/register src/scripts/seed-full-platform.ts
 */

import { PrismaClient } from '@prisma/client';
import { loadProjectEnv } from '../env';

loadProjectEnv();

const prisma = new PrismaClient();

async function main() {
  console.log('\n🚀 Starting full platform seed...\n');

  // ── Get tenant & users ─────────────────────────────────────────
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { subdomain: 'default' } });
  const tenantId = tenant.id;

  const superAdmin  = await prisma.user.findFirstOrThrow({ where: { email: 'super.admin@lms.dev' } });
  const admin       = await prisma.user.findFirstOrThrow({ where: { email: 'admin@lms.dev' } });
  const instructor  = await prisma.user.findFirstOrThrow({ where: { email: 'instructor@lms.dev' } });
  const learner     = await prisma.user.findFirstOrThrow({ where: { email: 'learner@lms.dev' } });

  // ── Designations ───────────────────────────────────────────────
  console.log('📋 Seeding designations...');
  const designations = await Promise.all([
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Chief Executive Officer' } }, create: { tenantId, name: 'Chief Executive Officer', level: 10 }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Vice President' } },           create: { tenantId, name: 'Vice President',           level: 9  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Department Head' } },          create: { tenantId, name: 'Department Head',          level: 8  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Senior Manager' } },           create: { tenantId, name: 'Senior Manager',           level: 7  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Manager' } },                  create: { tenantId, name: 'Manager',                  level: 6  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Senior Engineer' } },          create: { tenantId, name: 'Senior Engineer',          level: 5  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Engineer' } },                 create: { tenantId, name: 'Engineer',                 level: 4  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Senior Instructor' } },        create: { tenantId, name: 'Senior Instructor',        level: 5  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Analyst' } },                  create: { tenantId, name: 'Analyst',                  level: 3  }, update: {} }),
    prisma.designation.upsert({ where: { tenantId_name: { tenantId, name: 'Associate' } },                create: { tenantId, name: 'Associate',                level: 2  }, update: {} }),
  ]);
  console.log(`  ✅ ${designations.length} designations ready`);

  // ── Departments ────────────────────────────────────────────────
  console.log('🏢 Seeding departments...');
  const deptIT = await prisma.department.upsert({
    where: { tenantId_code: { tenantId, code: 'IT' } },
    create: { tenantId, name: 'Information Technology', code: 'IT', managerId: superAdmin.id },
    update: { managerId: superAdmin.id },
  });
  const deptHR = await prisma.department.upsert({
    where: { tenantId_code: { tenantId, code: 'HR' } },
    create: { tenantId, name: 'Human Resources', code: 'HR', managerId: admin.id },
    update: { managerId: admin.id },
  });
  const deptENG = await prisma.department.upsert({
    where: { tenantId_code: { tenantId, code: 'ENG' } },
    create: { tenantId, name: 'Engineering', code: 'ENG', parentId: deptIT.id, managerId: superAdmin.id },
    update: { parentId: deptIT.id },
  });
  const deptL_D = await prisma.department.upsert({
    where: { tenantId_code: { tenantId, code: 'LND' } },
    create: { tenantId, name: 'Learning & Development', code: 'LND', parentId: deptHR.id, managerId: instructor.id },
    update: { parentId: deptHR.id },
  });
  const deptOPS = await prisma.department.upsert({
    where: { tenantId_code: { tenantId, code: 'OPS' } },
    create: { tenantId, name: 'Operations', code: 'OPS' },
    update: {},
  });
  console.log(`  ✅ 5 departments ready`);

  // ── Employee Profiles ──────────────────────────────────────────
  console.log('👥 Seeding employee profiles...');
  const ceo = designations.find(d => d.name === 'Chief Executive Officer')!;
  const deptHead = designations.find(d => d.name === 'Department Head')!;
  const seniorInstructor = designations.find(d => d.name === 'Senior Instructor')!;
  const associate = designations.find(d => d.name === 'Associate')!;

  await prisma.employeeProfile.upsert({
    where: { userId: superAdmin.id },
    create: { userId: superAdmin.id, tenantId, employeeCode: 'EMP001', departmentId: deptIT.id, designationId: ceo.id, dateOfJoining: new Date('2020-01-01'), location: 'HQ', phone: '+91-9000000001' },
    update: { departmentId: deptIT.id, designationId: ceo.id },
  });
  await prisma.employeeProfile.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, tenantId, employeeCode: 'EMP002', departmentId: deptHR.id, designationId: deptHead.id, reportingManagerId: superAdmin.id, dateOfJoining: new Date('2021-03-15'), location: 'HQ', phone: '+91-9000000002' },
    update: { departmentId: deptHR.id, designationId: deptHead.id },
  });
  await prisma.employeeProfile.upsert({
    where: { userId: instructor.id },
    create: { userId: instructor.id, tenantId, employeeCode: 'EMP003', departmentId: deptL_D.id, designationId: seniorInstructor.id, reportingManagerId: admin.id, dateOfJoining: new Date('2022-06-01'), location: 'HQ', phone: '+91-9000000003' },
    update: { departmentId: deptL_D.id, designationId: seniorInstructor.id },
  });
  await prisma.employeeProfile.upsert({
    where: { userId: learner.id },
    create: { userId: learner.id, tenantId, employeeCode: 'EMP004', departmentId: deptENG.id, designationId: associate.id, reportingManagerId: superAdmin.id, dateOfJoining: new Date('2023-09-01'), location: 'Remote', phone: '+91-9000000004' },
    update: { departmentId: deptENG.id, designationId: associate.id },
  });
  console.log('  ✅ 4 employee profiles ready');

  // ── Projects ───────────────────────────────────────────────────
  console.log('📁 Seeding projects...');

  const proj1 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0001-000000000001' },
    create: {
      id: '00000000-0000-0000-0001-000000000001',
      tenantId, title: 'LMS Platform v2.0', description: 'Complete redesign and upgrade of the Learning Management System with AI features.', status: 'active',
      departmentId: deptENG.id, ownerId: superAdmin.id, startDate: new Date('2026-01-01'), targetEndDate: new Date('2026-12-31'),
    },
    update: {},
  });
  await prisma.milestone.createMany({
    data: [
      { projectId: proj1.id, title: 'Requirements Gathering',     status: 'completed', order: 1, dueDate: new Date('2026-02-01'), completedAt: new Date('2026-01-28') },
      { projectId: proj1.id, title: 'UI/UX Design',              status: 'completed', order: 2, dueDate: new Date('2026-03-01'), completedAt: new Date('2026-02-25') },
      { projectId: proj1.id, title: 'Backend Development',        status: 'in_progress', order: 3, dueDate: new Date('2026-07-01') },
      { projectId: proj1.id, title: 'Frontend Development',       status: 'pending',   order: 4, dueDate: new Date('2026-09-01') },
      { projectId: proj1.id, title: 'Testing & QA',               status: 'pending',   order: 5, dueDate: new Date('2026-11-01') },
      { projectId: proj1.id, title: 'Launch',                     status: 'pending',   order: 6, dueDate: new Date('2026-12-15') },
    ],
    skipDuplicates: true,
  });
  await prisma.projectMember.createMany({
    data: [
      { projectId: proj1.id, userId: superAdmin.id, role: 'owner' },
      { projectId: proj1.id, userId: admin.id,      role: 'manager' },
      { projectId: proj1.id, userId: instructor.id, role: 'member' },
      { projectId: proj1.id, userId: learner.id,    role: 'member' },
    ],
    skipDuplicates: true,
  });

  const proj2 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0001-000000000002' },
    create: {
      id: '00000000-0000-0000-0001-000000000002',
      tenantId, title: 'Employee Onboarding Revamp', description: 'Redesign the onboarding process for new hires with digital workflows.', status: 'planning',
      departmentId: deptHR.id, ownerId: admin.id, startDate: new Date('2026-07-01'), targetEndDate: new Date('2026-10-31'),
    },
    update: {},
  });
  await prisma.milestone.createMany({
    data: [
      { projectId: proj2.id, title: 'Stakeholder Interviews',     status: 'pending', order: 1, dueDate: new Date('2026-07-15') },
      { projectId: proj2.id, title: 'Process Mapping',            status: 'pending', order: 2, dueDate: new Date('2026-08-01') },
      { projectId: proj2.id, title: 'Digital Tool Setup',         status: 'pending', order: 3, dueDate: new Date('2026-09-01') },
      { projectId: proj2.id, title: 'Pilot Batch Onboarding',     status: 'pending', order: 4, dueDate: new Date('2026-10-15') },
    ],
    skipDuplicates: true,
  });
  await prisma.projectMember.createMany({
    data: [
      { projectId: proj2.id, userId: admin.id,      role: 'owner' },
      { projectId: proj2.id, userId: instructor.id, role: 'manager' },
    ],
    skipDuplicates: true,
  });

  const proj3 = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0001-000000000003' },
    create: {
      id: '00000000-0000-0000-0001-000000000003',
      tenantId, title: 'Annual Compliance Training', description: 'Mandatory annual compliance and safety training for all employees.', status: 'completed',
      departmentId: deptL_D.id, ownerId: instructor.id, startDate: new Date('2026-01-01'), targetEndDate: new Date('2026-03-31'), actualEndDate: new Date('2026-03-28'),
    },
    update: {},
  });
  await prisma.milestone.createMany({
    data: [
      { projectId: proj3.id, title: 'Content Creation',    status: 'completed', order: 1, dueDate: new Date('2026-01-20'), completedAt: new Date('2026-01-18') },
      { projectId: proj3.id, title: 'Course Publishing',   status: 'completed', order: 2, dueDate: new Date('2026-02-01'), completedAt: new Date('2026-01-31') },
      { projectId: proj3.id, title: 'All Staff Enrolled',  status: 'completed', order: 3, dueDate: new Date('2026-02-15'), completedAt: new Date('2026-02-12') },
      { projectId: proj3.id, title: 'Completion Report',   status: 'completed', order: 4, dueDate: new Date('2026-03-31'), completedAt: new Date('2026-03-28') },
    ],
    skipDuplicates: true,
  });
  await prisma.projectMember.createMany({
    data: [
      { projectId: proj3.id, userId: instructor.id, role: 'owner' },
      { projectId: proj3.id, userId: admin.id,      role: 'member' },
      { projectId: proj3.id, userId: learner.id,    role: 'member' },
    ],
    skipDuplicates: true,
  });
  console.log('  ✅ 3 projects + milestones + members ready');

  // ── Knowledge / Document Categories ───────────────────────────
  console.log('📚 Seeding knowledge categories & documents...');
  const docCatHR = await prisma.documentCategory.upsert({
    where: { tenantId_slug: { tenantId, slug: 'hr-policies' } },
    create: { tenantId, name: 'HR Policies', slug: 'hr-policies', description: 'All HR-related policy documents' },
    update: {},
  });
  const docCatSafety = await prisma.documentCategory.upsert({
    where: { tenantId_slug: { tenantId, slug: 'safety' } },
    create: { tenantId, name: 'Health & Safety', slug: 'safety', description: 'Workplace safety guidelines and SOPs' },
    update: {},
  });
  const docCatIT = await prisma.documentCategory.upsert({
    where: { tenantId_slug: { tenantId, slug: 'it-guidelines' } },
    create: { tenantId, name: 'IT Guidelines', slug: 'it-guidelines', description: 'IT usage policies and security guidelines' },
    update: {},
  });

  // Stub documents (without actual files — demo metadata only)
  await prisma.document.createMany({
    data: [
      { tenantId, categoryId: docCatHR.id, title: 'Employee Code of Conduct', description: 'Defines expected workplace behaviour for all employees.', type: 'policy', fileObjectKey: 'docs/hr/code-of-conduct-v1.pdf', fileName: 'code-of-conduct-v1.pdf', fileSize: 245760, mimeType: 'application/pdf', version: 1, uploadedById: admin.id, status: 'published', tags: ['hr', 'policy', 'conduct'] },
      { tenantId, categoryId: docCatHR.id, title: 'Leave Policy 2026',         description: 'Annual leave entitlements, types and application process.', type: 'policy', fileObjectKey: 'docs/hr/leave-policy-2026.pdf', fileName: 'leave-policy-2026.pdf', fileSize: 180224, mimeType: 'application/pdf', version: 2, uploadedById: admin.id, status: 'published', tags: ['hr', 'leave', 'policy'] },
      { tenantId, categoryId: docCatSafety.id, title: 'Fire Safety Procedures', description: 'Emergency evacuation procedures and fire safety guidelines.', type: 'procedure', fileObjectKey: 'docs/safety/fire-safety.pdf', fileName: 'fire-safety.pdf', fileSize: 102400, mimeType: 'application/pdf', version: 1, uploadedById: instructor.id, status: 'published', tags: ['safety', 'fire', 'emergency'] },
      { tenantId, categoryId: docCatSafety.id, title: 'Workplace Safety Manual', description: 'Comprehensive guide for maintaining a safe work environment.', type: 'manual', fileObjectKey: 'docs/safety/safety-manual.pdf', fileName: 'safety-manual.pdf', fileSize: 512000, mimeType: 'application/pdf', version: 3, uploadedById: instructor.id, status: 'published', tags: ['safety', 'manual', 'guidelines'] },
      { tenantId, categoryId: docCatIT.id, title: 'IT Security Policy',         description: 'Policies for data security, password management, and device usage.', type: 'policy', fileObjectKey: 'docs/it/security-policy.pdf', fileName: 'security-policy.pdf', fileSize: 307200, mimeType: 'application/pdf', version: 1, uploadedById: superAdmin.id, status: 'published', tags: ['it', 'security', 'policy'] },
      { tenantId, categoryId: docCatIT.id, title: 'Remote Work Guidelines',     description: 'Guidelines for employees working remotely — tools, expectations and support.', type: 'guideline', fileObjectKey: 'docs/it/remote-work.pdf', fileName: 'remote-work.pdf', fileSize: 153600, mimeType: 'application/pdf', version: 1, uploadedById: superAdmin.id, status: 'published', tags: ['remote', 'work', 'guidelines'] },
    ],
    skipDuplicates: true,
  });
  console.log('  ✅ 3 document categories + 6 documents ready');

  // ── Course Categories ──────────────────────────────────────────
  console.log('🎓 Seeding course categories...');
  const courseCategories = [
    { name: 'Compliance & Safety',   slug: 'compliance-safety' },
    { name: 'Communication Skills',  slug: 'communication-skills' },
    { name: 'Leadership',            slug: 'leadership' },
    { name: 'Technical Skills',      slug: 'technical-skills' },
    { name: 'HR & People',           slug: 'hr-people' },
    { name: 'Product & Business',    slug: 'product-business' },
  ];
  for (const cat of courseCategories) {
    await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: cat.slug } },
      create: { tenantId, ...cat },
      update: {},
    });
  }
  console.log(`  ✅ ${courseCategories.length} course categories ready`);

  // ── Notifications ──────────────────────────────────────────────
  console.log('🔔 Seeding notifications...');
  const allUsers = [superAdmin, admin, instructor, learner];
  for (const user of allUsers) {
    await prisma.notification.createMany({
      data: [
        { userId: user.id, tenantId, type: 'welcome', title: 'Welcome to the platform!', body: 'Your account is ready. Explore courses, projects and the knowledge base.', isRead: false },
        { userId: user.id, tenantId, type: 'course_published', title: 'New course available', body: '"Workplace Safety Essentials" is now available in the catalog.', isRead: false },
      ],
      skipDuplicates: false,
    });
  }
  console.log('  ✅ Notifications seeded for all users');

  console.log(`
✅ Full platform seed complete!

🏢 Organization:   5 departments, 10 designations, 4 employee profiles
📁 Projects:       3 projects (active/planning/completed) with milestones
📚 Knowledge:      3 doc categories, 6 published documents  
🎓 LMS:            6 course categories
🔔 Notifications:  2 per user (8 total)
`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
