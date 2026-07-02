/**
 * Seed Validation Script
 *
 * Populates the database with baseline data for the LMS validation suite.
 * Uses Prisma upsert for idempotency — safe to run multiple times.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { loadProjectEnv } from '../env';
import {
  getKeycloakInternalUrl,
  getKeycloakRealm,
} from '../config/runtime';
import {
  getKeycloakAdminToken,
  waitForKeycloakReady,
} from './keycloak-provisioning';
interface SeedUser {
  id: string;
  keycloakId: string;
  email: string;
  password: string;
  role: 'admin' | 'instructor' | 'learner' | 'employee-only';
}

interface SeedResult {
  tenant: { id: string; subdomain: string };
  users: {
    admin: SeedUser;
    instructor: SeedUser;
    learner: SeedUser;
    employeeOnly?: SeedUser;
  };
  departments: { parentId: string; childId: string };
  designations: { seniorId: string; juniorId: string };
  categories: string[];
  courses: {
    publishedId: string;
    reviewId: string;
    draftId: string;
  };
  assessments: { courseId: string; assessmentId: string }[];
  certificateTemplateId: string;
  documents: string[];
  documentCategories: string[];
  project: { id: string; milestoneIds: string[] };
  summary: Record<string, number>;
}

// ─── Configuration ───────────────────────────────────────────────────────────

loadProjectEnv();

const TENANT_NAME = 'Default LMS';
const TENANT_SUBDOMAIN = 'default';

const SEED_USERS = [
  {
    email: 'admin@lms-validation.local',
    firstName: 'Admin',
    lastName: 'User',
    password: 'Admin123!',
    roles: ['admin'],
  },
  {
    email: 'instructor@lms-validation.local',
    firstName: 'Instructor',
    lastName: 'User',
    password: 'Instructor123!',
    roles: ['instructor'],
  },
  {
    email: 'learner@lms-validation.local',
    firstName: 'Learner',
    lastName: 'User',
    password: 'Learner123!',
    roles: ['learner'],
  },
  {
    email: 'employee@lms-validation.local',
    firstName: 'Employee',
    lastName: 'User',
    password: 'Employee123!',
    roles: ['employee-only'],
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

function logSkipped(entity: string, identifier: string): void {
  console.log(`  ⏭  ${entity} "${identifier}" already exists — skipped`);
}

function logCreated(entity: string, identifier: string): void {
  console.log(`  ✓  ${entity} "${identifier}" created`);
}

function logWarning(entity: string, identifier: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message : String(error);
  console.warn(`  ⚠  ${entity} "${identifier}" failed: ${message}`);
}

// ─── Keycloak User Provisioning ──────────────────────────────────────────────

interface KeycloakUserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roles: readonly string[];
}

async function ensureKeycloakUser(
  adminToken: string,
  user: KeycloakUserInput,
): Promise<string | null> {
  const keycloakBaseUrl = getKeycloakInternalUrl();
  const realm = getKeycloakRealm();
  const usersUrl = `${keycloakBaseUrl}/admin/realms/${realm}/users`;

  try {
    // Check if user already exists
    const searchResponse = await axios.get<Array<{ id: string }>>(usersUrl, {
      params: { email: user.email, exact: true },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (searchResponse.data.length > 0) {
      const existingId = searchResponse.data[0].id;
      logSkipped('Keycloak user', user.email);
      return existingId;
    }

    // Create user
    await axios.post(
      usersUrl,
      {
        email: user.email,
        username: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: true,
        emailVerified: true,
        credentials: [
          {
            type: 'password',
            value: user.password,
            temporary: false,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    // Fetch the created user to get the ID
    const createdResponse = await axios.get<Array<{ id: string }>>(usersUrl, {
      params: { email: user.email, exact: true },
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const keycloakId = createdResponse.data[0]?.id;
    if (!keycloakId) {
      throw new Error('User created but could not retrieve ID');
    }

    // Assign realm roles
    for (const roleName of user.roles) {
      try {
        const roleResponse = await axios.get<{ id: string; name: string }>(
          `${keycloakBaseUrl}/admin/realms/${realm}/roles/${roleName}`,
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );

        await axios.post(
          `${usersUrl}/${keycloakId}/role-mappings/realm`,
          [roleResponse.data],
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
      } catch {
        console.warn(`    ⚠  Could not assign role "${roleName}" — role may not exist`);
      }
    }

    logCreated('Keycloak user', user.email);
    return keycloakId;
  } catch (error) {
    logWarning('Keycloak user', user.email, error);
    return null;
  }
}

// ─── Database Seeding ────────────────────────────────────────────────────────

async function seedTenant(prisma: PrismaClient): Promise<{ id: string; subdomain: string } | null> {
  try {
    const tenant = await prisma.tenant.upsert({
      where: { subdomain: TENANT_SUBDOMAIN },
      create: { name: TENANT_NAME, subdomain: TENANT_SUBDOMAIN },
      update: { name: TENANT_NAME },
    });
    logCreated('Tenant', TENANT_SUBDOMAIN);
    return { id: tenant.id, subdomain: tenant.subdomain };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logSkipped('Tenant', TENANT_SUBDOMAIN);
      // Fetch existing tenant
      const existing = await prisma.tenant.findUnique({
        where: { subdomain: TENANT_SUBDOMAIN },
      });
      return existing ? { id: existing.id, subdomain: existing.subdomain } : null;
    }
    logWarning('Tenant', TENANT_SUBDOMAIN, error);
    return null;
  }
}

async function seedUser(
  prisma: PrismaClient,
  tenantId: string,
  keycloakId: string,
  userConfig: KeycloakUserInput,
): Promise<SeedUser | null> {
  try {
    const user = await prisma.user.upsert({
      where: { email: userConfig.email },
      create: {
        keycloakId,
        email: userConfig.email,
        firstName: userConfig.firstName,
        lastName: userConfig.lastName,
        roles: [...userConfig.roles],
        isActive: true,
        tenantId,
      },
      update: {
        keycloakId,
        firstName: userConfig.firstName,
        lastName: userConfig.lastName,
        roles: [...userConfig.roles],
        isActive: true,
        tenantId,
      },
    });
    logCreated('User', userConfig.email);
    return {
      id: user.id,
      keycloakId: user.keycloakId,
      email: user.email,
      password: userConfig.password,
      role: userConfig.roles[0] as SeedUser['role'],
    };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      logSkipped('User', userConfig.email);
      // Fetch existing user
      const existing = await prisma.user.findUnique({
        where: { email: userConfig.email },
      });
      if (existing) {
        return {
          id: existing.id,
          keycloakId: existing.keycloakId,
          email: existing.email,
          password: userConfig.password,
          role: userConfig.roles[0] as SeedUser['role'],
        };
      }
      return null;
    }
    logWarning('User', userConfig.email, error);
    return null;
  }
}

// ─── Knowledge Document Seeding ──────────────────────────────────────────────

interface DocumentCategoryResult {
  id: string;
  name: string;
}

async function seedDocumentCategories(
  prisma: PrismaClient,
  tenantId: string,
): Promise<DocumentCategoryResult[]> {
  const categories = [
    { name: 'Policies & Procedures', slug: 'policies-procedures', description: 'Company policies and standard operating procedures' },
    { name: 'Technical Documentation', slug: 'technical-docs', description: 'Technical guides and API documentation' },
  ];

  const results: DocumentCategoryResult[] = [];

  for (const cat of categories) {
    try {
      const docCategory = await prisma.documentCategory.upsert({
        where: { tenantId_slug: { tenantId, slug: cat.slug } },
        create: {
          tenantId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
        },
        update: { name: cat.name, description: cat.description },
      });
      logCreated('Document Category', cat.name);
      results.push({ id: docCategory.id, name: docCategory.name });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Document Category', cat.name);
        const existing = await prisma.documentCategory.findUnique({
          where: { tenantId_slug: { tenantId, slug: cat.slug } },
        });
        if (existing) results.push({ id: existing.id, name: existing.name });
      } else {
        logWarning('Document Category', cat.name, error);
      }
    }
  }

  return results;
}

async function seedKnowledgeDocuments(
  prisma: PrismaClient,
  tenantId: string,
  categoryIds: string[],
  uploaderId: string,
): Promise<string[]> {
  const documents = [
    {
      title: 'Employee Onboarding Guide',
      description: 'Comprehensive guide for new employee onboarding process',
      type: 'policy',
      categoryId: categoryIds[0],
      fileName: 'onboarding-guide-v2.pdf',
      fileObjectKey: `documents/${tenantId}/onboarding-guide-v2.pdf`,
      fileSize: 2048576, // ~2MB
      mimeType: 'application/pdf',
      tags: ['onboarding', 'hr', 'new-hire'],
      status: 'published',
    },
    {
      title: 'API Integration Reference',
      description: 'Technical reference for third-party API integrations',
      type: 'reference',
      categoryId: categoryIds[1],
      fileName: 'api-integration-ref-v1.docx',
      fileObjectKey: `documents/${tenantId}/api-integration-ref-v1.docx`,
      fileSize: 1536000, // ~1.5MB
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      tags: ['api', 'integration', 'technical'],
      status: 'published',
    },
  ];

  const documentIds: string[] = [];

  for (const doc of documents) {
    try {
      // Use a unique identifier based on title + tenant for idempotent lookup
      const existing = await prisma.document.findFirst({
        where: { tenantId, title: doc.title },
      });

      let document;
      if (existing) {
        document = existing;
        logSkipped('Document', doc.title);
      } else {
        document = await prisma.document.create({
          data: {
            tenantId,
            categoryId: doc.categoryId,
            title: doc.title,
            description: doc.description,
            type: doc.type,
            fileObjectKey: doc.fileObjectKey,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            tags: doc.tags,
            status: doc.status,
            uploadedById: uploaderId,
            version: 1,
          },
        });
        logCreated('Document', doc.title);
      }

      documentIds.push(document.id);

      // Create a versioned upload entry (simulates MinIO versioned upload)
      try {
        await prisma.documentVersion.upsert({
          where: {
            documentId_versionNumber: { documentId: document.id, versionNumber: 1 },
          },
          create: {
            documentId: document.id,
            versionNumber: 1,
            fileObjectKey: doc.fileObjectKey,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            uploadedById: uploaderId,
            changeNote: 'Initial upload',
          },
          update: {
            fileObjectKey: doc.fileObjectKey,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
          },
        });
        logCreated('Document Version', `${doc.title} v1`);
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('Document Version', `${doc.title} v1`);
        } else {
          logWarning('Document Version', `${doc.title} v1`, error);
        }
      }
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Document', doc.title);
      } else {
        logWarning('Document', doc.title, error);
      }
    }
  }

  return documentIds;
}

// ─── Project Seeding ─────────────────────────────────────────────────────────

interface ProjectSeedResult {
  id: string;
  milestoneIds: string[];
}

async function seedProject(
  prisma: PrismaClient,
  tenantId: string,
  ownerId: string,
  memberIds: string[],
): Promise<ProjectSeedResult | null> {
  const projectTitle = 'LMS Platform Enhancement';

  try {
    // Upsert project
    let project = await prisma.project.findFirst({
      where: { tenantId, title: projectTitle },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          tenantId,
          title: projectTitle,
          description: 'Enhance the LMS platform with new features and improvements',
          status: 'in_progress',
          ownerId,
          startDate: new Date('2025-01-15'),
          targetEndDate: new Date('2025-06-30'),
        },
      });
      logCreated('Project', projectTitle);
    } else {
      logSkipped('Project', projectTitle);
    }

    // Seed 3 milestones
    const milestones = [
      { title: 'Requirements & Design', order: 1, dueDate: new Date('2025-02-28'), status: 'completed' },
      { title: 'Core Implementation', order: 2, dueDate: new Date('2025-04-30'), status: 'in_progress' },
      { title: 'Testing & Deployment', order: 3, dueDate: new Date('2025-06-30'), status: 'pending' },
    ];

    const milestoneIds: string[] = [];

    for (const ms of milestones) {
      try {
        const milestone = await prisma.milestone.upsert({
          where: { projectId_order: { projectId: project.id, order: ms.order } },
          create: {
            projectId: project.id,
            title: ms.title,
            status: ms.status,
            dueDate: ms.dueDate,
            order: ms.order,
            completedAt: ms.status === 'completed' ? new Date('2025-02-25') : undefined,
          },
          update: {
            title: ms.title,
            status: ms.status,
            dueDate: ms.dueDate,
          },
        });
        logCreated('Milestone', ms.title);
        milestoneIds.push(milestone.id);
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('Milestone', ms.title);
          const existing = await prisma.milestone.findUnique({
            where: { projectId_order: { projectId: project.id, order: ms.order } },
          });
          if (existing) milestoneIds.push(existing.id);
        } else {
          logWarning('Milestone', ms.title, error);
        }
      }
    }

    // Seed 2 team members
    const memberRoles = ['lead', 'member'];
    for (let i = 0; i < Math.min(memberIds.length, 2); i++) {
      try {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: project.id, userId: memberIds[i] } },
          create: {
            projectId: project.id,
            userId: memberIds[i],
            role: memberRoles[i],
          },
          update: { role: memberRoles[i] },
        });
        logCreated('Project Member', `${memberRoles[i]} (user ${i + 1})`);
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('Project Member', `${memberRoles[i]} (user ${i + 1})`);
        } else {
          logWarning('Project Member', `${memberRoles[i]} (user ${i + 1})`, error);
        }
      }
    }

    return { id: project.id, milestoneIds };
  } catch (error) {
    logWarning('Project', projectTitle, error);
    return null;
  }
}

// ─── Analytics & Audit Seeding ───────────────────────────────────────────────

async function seedAnalyticsEvents(
  prisma: PrismaClient,
  tenantId: string,
  actorId: string,
): Promise<number> {
  const events = [
    {
      type: 'enrollment',
      entityType: 'course',
      entityId: 'seed-course-placeholder',
      payload: { action: 'enrolled', source: 'seed-script' },
    },
    {
      type: 'lesson_completion',
      entityType: 'lesson',
      entityId: 'seed-lesson-placeholder',
      payload: { action: 'completed', duration: 1200 },
    },
    {
      type: 'assessment_submission',
      entityType: 'assessment',
      entityId: 'seed-assessment-placeholder',
      payload: { action: 'submitted', score: 85, passed: true },
    },
    {
      type: 'document_view',
      entityType: 'document',
      entityId: 'seed-document-placeholder',
      payload: { action: 'viewed', source: 'knowledge-assistant' },
    },
  ];

  let count = 0;
  const baseTime = new Date();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const occurredAt = new Date(baseTime.getTime() - (events.length - i) * 60000); // stagger by 1 min

    try {
      await prisma.analyticsEvent.create({
        data: {
          tenantId,
          actorId,
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          occurredAt,
          payload: event.payload,
        },
      });
      logCreated('Analytics Event', event.type);
      count++;
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Analytics Event', event.type);
      } else {
        logWarning('Analytics Event', event.type, error);
      }
    }
  }

  return count;
}

async function seedAuditLogs(
  prisma: PrismaClient,
  tenantId: string,
  actorId: string,
): Promise<number> {
  const auditEntries = [
    {
      action: 'user_created',
      entityType: 'user',
      entityId: 'seed-user-placeholder',
      metadata: { email: 'learner@lms-validation.local', role: 'learner' },
    },
    {
      action: 'course_created',
      entityType: 'course',
      entityId: 'seed-course-placeholder',
      metadata: { title: 'Validation Course', status: 'draft' },
    },
    {
      action: 'document_uploaded',
      entityType: 'document',
      entityId: 'seed-document-placeholder',
      metadata: { title: 'Employee Onboarding Guide', mimeType: 'application/pdf' },
    },
    {
      action: 'project_created',
      entityType: 'project',
      entityId: 'seed-project-placeholder',
      metadata: { title: 'LMS Platform Enhancement' },
    },
    {
      action: 'enrollment_created',
      entityType: 'enrollment',
      entityId: 'seed-enrollment-placeholder',
      metadata: { courseTitle: 'Published Course', learnerEmail: 'learner@lms-validation.local' },
    },
  ];

  let count = 0;

  for (const entry of auditEntries) {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata,
          ipAddress: '127.0.0.1',
          userAgent: 'seed-validation-script/1.0',
        },
      });
      logCreated('Audit Log', entry.action);
      count++;
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Audit Log', entry.action);
      } else {
        logWarning('Audit Log', entry.action, error);
      }
    }
  }

  return count;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  LMS Validation Seed - Tenant & Users');
  console.log('═══════════════════════════════════════');
  console.log('');

  // Initialize Prisma
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  await prisma.$connect();

  const summary: Record<string, number> = {};

  try {
    // ── Step 1: Seed Tenant ──────────────────────────────────────────────────
    console.log('▸ Seeding tenant...');
    const tenant = await seedTenant(prisma);

    if (!tenant) {
      console.error('');
      console.error('FATAL: Could not create or find tenant. Aborting.');
      process.exit(1);
    }
    summary['Tenants'] = 1;

    // ── Step 2: Provision Keycloak Users ─────────────────────────────────────
    console.log('');
    console.log('▸ Provisioning Keycloak users...');

    let adminToken: string;
    try {
      await waitForKeycloakReady();
      adminToken = await getKeycloakAdminToken();
    } catch (error) {
      console.warn('');
      console.warn('⚠  Keycloak is not reachable. Skipping Keycloak user provisioning.');
      console.warn('   Users will be created in the database with placeholder Keycloak IDs.');
      console.warn('');
      adminToken = '';
    }

    // ── Step 3: Seed Users ───────────────────────────────────────────────────
    console.log('');
    console.log('▸ Seeding users...');

    const users: Record<string, SeedUser | null> = {};
    let userCount = 0;

    for (const userConfig of SEED_USERS) {
      let keycloakId: string;

      if (adminToken) {
        const kcId = await ensureKeycloakUser(adminToken, userConfig);
        keycloakId = kcId ?? `placeholder-${userConfig.email}`;
      } else {
        keycloakId = `placeholder-${userConfig.email}`;
      }

      const seededUser = await seedUser(prisma, tenant.id, keycloakId, userConfig);
      const roleKey = userConfig.roles[0] === 'employee-only' ? 'employeeOnly' : userConfig.roles[0];
      users[roleKey] = seededUser;

      if (seededUser) {
        userCount++;
      }
    }

    summary['Users'] = userCount;

    // ── Step 4: Seed Departments ─────────────────────────────────────────────
    console.log('');
    console.log('▸ Seeding departments...');

    let parentDeptId = '';
    let childDeptId = '';

    try {
      const parentDept = await prisma.department.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: 'ENGINEERING' } },
        create: {
          tenantId: tenant.id,
          name: 'Engineering',
          code: 'ENGINEERING',
        },
        update: { name: 'Engineering' },
      });
      parentDeptId = parentDept.id;
      logCreated('Department', 'Engineering (parent)');
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Department', 'Engineering (parent)');
        const existing = await prisma.department.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: 'ENGINEERING' } },
        });
        if (existing) parentDeptId = existing.id;
      } else {
        logWarning('Department', 'Engineering (parent)', error);
      }
    }

    try {
      const childDept = await prisma.department.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: 'ENG-FRONTEND' } },
        create: {
          tenantId: tenant.id,
          name: 'Frontend Engineering',
          code: 'ENG-FRONTEND',
          parentId: parentDeptId || undefined,
        },
        update: { name: 'Frontend Engineering', parentId: parentDeptId || undefined },
      });
      childDeptId = childDept.id;
      logCreated('Department', 'Frontend Engineering (child)');
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Department', 'Frontend Engineering (child)');
        const existing = await prisma.department.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: 'ENG-FRONTEND' } },
        });
        if (existing) childDeptId = existing.id;
      } else {
        logWarning('Department', 'Frontend Engineering (child)', error);
      }
    }

    summary['Departments'] = (parentDeptId ? 1 : 0) + (childDeptId ? 1 : 0);

    // ── Step 5: Seed Designations ────────────────────────────────────────────
    console.log('');
    console.log('▸ Seeding designations...');

    let seniorDesignationId = '';
    let juniorDesignationId = '';

    try {
      const seniorDesig = await prisma.designation.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'Senior Engineer' } },
        create: {
          tenantId: tenant.id,
          name: 'Senior Engineer',
          level: 3,
        },
        update: { level: 3 },
      });
      seniorDesignationId = seniorDesig.id;
      logCreated('Designation', 'Senior Engineer');
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Designation', 'Senior Engineer');
        const existing = await prisma.designation.findUnique({
          where: { tenantId_name: { tenantId: tenant.id, name: 'Senior Engineer' } },
        });
        if (existing) seniorDesignationId = existing.id;
      } else {
        logWarning('Designation', 'Senior Engineer', error);
      }
    }

    try {
      const juniorDesig = await prisma.designation.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'Junior Engineer' } },
        create: {
          tenantId: tenant.id,
          name: 'Junior Engineer',
          level: 1,
        },
        update: { level: 1 },
      });
      juniorDesignationId = juniorDesig.id;
      logCreated('Designation', 'Junior Engineer');
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        logSkipped('Designation', 'Junior Engineer');
        const existing = await prisma.designation.findUnique({
          where: { tenantId_name: { tenantId: tenant.id, name: 'Junior Engineer' } },
        });
        if (existing) juniorDesignationId = existing.id;
      } else {
        logWarning('Designation', 'Junior Engineer', error);
      }
    }

    summary['Designations'] = (seniorDesignationId ? 1 : 0) + (juniorDesignationId ? 1 : 0);

    // ── Step 6: Seed Employee Profile ────────────────────────────────────────
    console.log('');
    console.log('▸ Seeding employee profile...');

    let employeeProfileCount = 0;
    const learnerUser = users['learner'];

    if (learnerUser) {
      try {
        await prisma.employeeProfile.upsert({
          where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'EMP-001' } },
          create: {
            userId: learnerUser.id,
            tenantId: tenant.id,
            employeeCode: 'EMP-001',
            departmentId: childDeptId || undefined,
            designationId: juniorDesignationId || undefined,
            dateOfJoining: new Date('2024-01-15'),
            location: 'Remote',
          },
          update: {
            departmentId: childDeptId || undefined,
            designationId: juniorDesignationId || undefined,
          },
        });
        logCreated('EmployeeProfile', 'EMP-001');
        employeeProfileCount = 1;
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('EmployeeProfile', 'EMP-001');
          employeeProfileCount = 1;
        } else {
          logWarning('EmployeeProfile', 'EMP-001', error);
        }
      }
    }

    summary['Employee Profiles'] = employeeProfileCount;

    // ── Step 7: Seed Categories ──────────────────────────────────────────────
    console.log('');
    console.log('▸ Seeding categories...');

    const categoryIds: string[] = [];

    const categoryConfigs = [
      { name: 'Web Development', slug: 'web-development' },
      { name: 'Data Science', slug: 'data-science' },
    ];

    for (const catConfig of categoryConfigs) {
      try {
        const category = await prisma.category.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: catConfig.slug } },
          create: {
            tenantId: tenant.id,
            name: catConfig.name,
            slug: catConfig.slug,
          },
          update: { name: catConfig.name },
        });
        categoryIds.push(category.id);
        logCreated('Category', catConfig.name);
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('Category', catConfig.name);
          const existing = await prisma.category.findUnique({
            where: { tenantId_slug: { tenantId: tenant.id, slug: catConfig.slug } },
          });
          if (existing) categoryIds.push(existing.id);
        } else {
          logWarning('Category', catConfig.name, error);
        }
      }
    }

    summary['Categories'] = categoryIds.length;

    // ── Step 8: Seed Courses with Modules and Lessons ────────────────────────
    console.log('');
    console.log('▸ Seeding courses, modules, and lessons...');

    const instructorUser = users['instructor'];
    let publishedCourseId = '';
    let reviewCourseId = '';
    let draftCourseId = '';
    let moduleCount = 0;
    let lessonCount = 0;

    const courseConfigs = [
      {
        title: 'Introduction to React',
        slug: 'intro-to-react',
        description: 'Learn the fundamentals of React including components, hooks, and state management.',
        status: 'published',
        categoryIndex: 0,
      },
      {
        title: 'Advanced Python for Data Science',
        slug: 'advanced-python-data-science',
        description: 'Master Python libraries for data analysis, visualization, and machine learning.',
        status: 'in_review',
        categoryIndex: 1,
      },
      {
        title: 'DevOps Fundamentals',
        slug: 'devops-fundamentals',
        description: 'Introduction to CI/CD, containerization, and infrastructure as code.',
        status: 'draft',
        categoryIndex: 0,
      },
    ];

    const moduleConfigs = [
      { title: 'Getting Started', order: 1 },
      { title: 'Advanced Concepts', order: 2 },
    ];

    const lessonConfigs = [
      { title: 'Introduction', type: 'text', order: 1 },
      { title: 'Hands-on Exercise', type: 'video', order: 2 },
    ];

    // Track lesson IDs for assessments (first lesson of each course's first module)
    const courseLessonIds: Record<string, string[]> = {};

    for (const courseConfig of courseConfigs) {
      const creatorId = instructorUser?.id;
      if (!creatorId) {
        console.warn('  ⚠  No instructor user available — skipping course creation');
        continue;
      }

      let courseId = '';
      try {
        const course = await prisma.course.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: courseConfig.slug } },
          create: {
            tenantId: tenant.id,
            title: courseConfig.title,
            slug: courseConfig.slug,
            description: courseConfig.description,
            status: courseConfig.status,
            categoryId: categoryIds[courseConfig.categoryIndex] || undefined,
            createdById: creatorId,
          },
          update: {
            title: courseConfig.title,
            description: courseConfig.description,
            status: courseConfig.status,
            categoryId: categoryIds[courseConfig.categoryIndex] || undefined,
          },
        });
        courseId = course.id;
        logCreated('Course', courseConfig.title);
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('Course', courseConfig.title);
          const existing = await prisma.course.findUnique({
            where: { tenantId_slug: { tenantId: tenant.id, slug: courseConfig.slug } },
          });
          if (existing) courseId = existing.id;
        } else {
          logWarning('Course', courseConfig.title, error);
          continue;
        }
      }

      if (!courseId) continue;

      // Track course IDs by status
      if (courseConfig.status === 'published') publishedCourseId = courseId;
      else if (courseConfig.status === 'in_review') reviewCourseId = courseId;
      else if (courseConfig.status === 'draft') draftCourseId = courseId;

      courseLessonIds[courseId] = [];

      // Create modules and lessons for this course
      for (const modConfig of moduleConfigs) {
        let moduleId = '';
        try {
          const mod = await prisma.courseModule.upsert({
            where: { courseId_order: { courseId, order: modConfig.order } },
            create: {
              title: `${modConfig.title} - ${courseConfig.title}`,
              order: modConfig.order,
              courseId,
            },
            update: { title: `${modConfig.title} - ${courseConfig.title}` },
          });
          moduleId = mod.id;
          moduleCount++;
          logCreated('Module', `${modConfig.title} (course: ${courseConfig.slug})`);
        } catch (error) {
          if (isPrismaUniqueConstraintError(error)) {
            logSkipped('Module', `${modConfig.title} (course: ${courseConfig.slug})`);
            const existing = await prisma.courseModule.findUnique({
              where: { courseId_order: { courseId, order: modConfig.order } },
            });
            if (existing) {
              moduleId = existing.id;
              moduleCount++;
            }
          } else {
            logWarning('Module', `${modConfig.title} (course: ${courseConfig.slug})`, error);
            continue;
          }
        }

        if (!moduleId) continue;

        // Create lessons for this module
        for (const lessonConfig of lessonConfigs) {
          try {
            const lesson = await prisma.lesson.upsert({
              where: { id: `seed-lesson-${courseConfig.slug}-m${modConfig.order}-l${lessonConfig.order}` },
              create: {
                id: `seed-lesson-${courseConfig.slug}-m${modConfig.order}-l${lessonConfig.order}`,
                title: `${lessonConfig.title} - Module ${modConfig.order}`,
                type: lessonConfig.type,
                moduleId,
                content: { body: `Content for ${lessonConfig.title} in ${courseConfig.title}` },
                duration: 600,
              },
              update: {
                title: `${lessonConfig.title} - Module ${modConfig.order}`,
                type: lessonConfig.type,
              },
            });
            lessonCount++;
            courseLessonIds[courseId].push(lesson.id);
            logCreated('Lesson', `${lessonConfig.title} (module ${modConfig.order}, course: ${courseConfig.slug})`);
          } catch (error) {
            if (isPrismaUniqueConstraintError(error)) {
              logSkipped('Lesson', `${lessonConfig.title} (module ${modConfig.order}, course: ${courseConfig.slug})`);
              lessonCount++;
              courseLessonIds[courseId].push(
                `seed-lesson-${courseConfig.slug}-m${modConfig.order}-l${lessonConfig.order}`,
              );
            } else {
              logWarning('Lesson', `${lessonConfig.title} (module ${modConfig.order}, course: ${courseConfig.slug})`, error);
            }
          }
        }
      }
    }

    summary['Courses'] = (publishedCourseId ? 1 : 0) + (reviewCourseId ? 1 : 0) + (draftCourseId ? 1 : 0);
    summary['Modules'] = moduleCount;
    summary['Lessons'] = lessonCount;

    // ── Step 9: Seed Assessments with Questions ──────────────────────────────
    console.log('');
    console.log('▸ Seeding assessments and questions...');

    let assessmentCount = 0;
    let questionCount = 0;
    const assessmentResults: { courseId: string; assessmentId: string }[] = [];

    // Create assessments on the first lesson of the published and review courses
    const assessmentCourses = [
      { courseId: publishedCourseId, label: 'Published Course Assessment' },
      { courseId: reviewCourseId, label: 'Review Course Assessment' },
    ];

    for (const assessConfig of assessmentCourses) {
      if (!assessConfig.courseId) continue;

      const lessonIds = courseLessonIds[assessConfig.courseId] || [];
      // Use the first lesson of the course for the assessment
      const targetLessonId = lessonIds[0];
      if (!targetLessonId) {
        console.warn(`  ⚠  No lessons found for course ${assessConfig.courseId} — skipping assessment`);
        continue;
      }

      let assessmentId = '';
      try {
        const assessment = await prisma.assessment.upsert({
          where: { lessonId: targetLessonId },
          create: {
            lessonId: targetLessonId,
            title: assessConfig.label,
            description: `Assessment for validation testing`,
            passingScore: 70,
            maxAttempts: 3,
          },
          update: {
            title: assessConfig.label,
            description: `Assessment for validation testing`,
          },
        });
        assessmentId = assessment.id;
        assessmentCount++;
        logCreated('Assessment', assessConfig.label);
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('Assessment', assessConfig.label);
          const existing = await prisma.assessment.findUnique({
            where: { lessonId: targetLessonId },
          });
          if (existing) {
            assessmentId = existing.id;
            assessmentCount++;
          }
        } else {
          logWarning('Assessment', assessConfig.label, error);
          continue;
        }
      }

      if (!assessmentId) continue;
      assessmentResults.push({ courseId: assessConfig.courseId, assessmentId });

      // Create 3 questions per assessment
      const questionConfigs = [
        { text: 'What is the primary purpose of this module?', order: 1 },
        { text: 'Which of the following is a best practice?', order: 2 },
        { text: 'What is the expected output of this operation?', order: 3 },
      ];

      for (const qConfig of questionConfigs) {
        let questionId = '';
        try {
          const question = await prisma.question.upsert({
            where: { assessmentId_order: { assessmentId, order: qConfig.order } },
            create: {
              assessmentId,
              type: 'multiple_choice',
              text: qConfig.text,
              explanation: `Explanation for question ${qConfig.order}`,
              points: 1,
              order: qConfig.order,
            },
            update: {
              text: qConfig.text,
              type: 'multiple_choice',
            },
          });
          questionId = question.id;
          questionCount++;
          logCreated('Question', `Q${qConfig.order} (${assessConfig.label})`);
        } catch (error) {
          if (isPrismaUniqueConstraintError(error)) {
            logSkipped('Question', `Q${qConfig.order} (${assessConfig.label})`);
            const existing = await prisma.question.findUnique({
              where: { assessmentId_order: { assessmentId, order: qConfig.order } },
            });
            if (existing) {
              questionId = existing.id;
              questionCount++;
            }
          } else {
            logWarning('Question', `Q${qConfig.order} (${assessConfig.label})`, error);
            continue;
          }
        }

        if (!questionId) continue;

        // Create 4 options per question (1 correct, 3 incorrect)
        const optionConfigs = [
          { text: 'Option A (correct)', isCorrect: true, order: 1 },
          { text: 'Option B', isCorrect: false, order: 2 },
          { text: 'Option C', isCorrect: false, order: 3 },
          { text: 'Option D', isCorrect: false, order: 4 },
        ];

        for (const optConfig of optionConfigs) {
          try {
            await prisma.questionOption.upsert({
              where: { questionId_order: { questionId, order: optConfig.order } },
              create: {
                questionId,
                text: optConfig.text,
                isCorrect: optConfig.isCorrect,
                order: optConfig.order,
              },
              update: {
                text: optConfig.text,
                isCorrect: optConfig.isCorrect,
              },
            });
          } catch (error) {
            if (!isPrismaUniqueConstraintError(error)) {
              logWarning('QuestionOption', `Option ${optConfig.order} (Q${qConfig.order})`, error);
            }
          }
        }
      }
    }

    summary['Assessments'] = assessmentCount;
    summary['Questions'] = questionCount;

    // ── Step 10: Seed Certificate Template ───────────────────────────────────
    console.log('');
    console.log('▸ Seeding certificate template...');

    let certificateTemplateId = '';

    if (publishedCourseId) {
      try {
        const certTemplate = await prisma.certificateTemplate.upsert({
          where: { courseId: publishedCourseId },
          create: {
            tenantId: tenant.id,
            courseId: publishedCourseId,
            title: 'Course Completion Certificate',
            description: 'Awarded upon successful completion of the course with passing assessment score.',
            isActive: true,
          },
          update: {
            title: 'Course Completion Certificate',
            description: 'Awarded upon successful completion of the course with passing assessment score.',
            isActive: true,
          },
        });
        certificateTemplateId = certTemplate.id;
        logCreated('CertificateTemplate', 'Course Completion Certificate');
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          logSkipped('CertificateTemplate', 'Course Completion Certificate');
          const existing = await prisma.certificateTemplate.findUnique({
            where: { courseId: publishedCourseId },
          });
          if (existing) certificateTemplateId = existing.id;
        } else {
          logWarning('CertificateTemplate', 'Course Completion Certificate', error);
        }
      }
    }

    summary['Certificate Templates'] = certificateTemplateId ? 1 : 0;

    // ── Step 11: Seed Document Categories ────────────────────────────────────
    console.log('');
    console.log('▸ Seeding document categories...');

    const docCategories = await seedDocumentCategories(prisma, tenant.id);
    summary['Document Categories'] = docCategories.length;

    // ── Step 12: Seed Knowledge Documents ────────────────────────────────────
    console.log('');
    console.log('▸ Seeding knowledge documents...');

    const uploaderId = users['instructor']?.id ?? users['admin']?.id ?? '';
    const documentIds = await seedKnowledgeDocuments(
      prisma,
      tenant.id,
      docCategories.map((c) => c.id),
      uploaderId,
    );
    summary['Documents'] = documentIds.length;
    summary['Document Versions'] = documentIds.length; // 1 version per document

    // ── Step 13: Seed Project with Milestones & Members ──────────────────────
    console.log('');
    console.log('▸ Seeding project...');

    const projectMemberIds = [
      users['instructor']?.id,
      users['learner']?.id,
    ].filter((id): id is string => !!id);

    const projectResult = await seedProject(
      prisma,
      tenant.id,
      users['admin']?.id ?? '',
      projectMemberIds,
    );
    summary['Projects'] = projectResult ? 1 : 0;
    summary['Milestones'] = projectResult?.milestoneIds.length ?? 0;
    summary['Project Members'] = Math.min(projectMemberIds.length, 2);

    // ── Step 14: Seed Analytics Events ───────────────────────────────────────
    console.log('');
    console.log('▸ Seeding analytics events...');

    const analyticsCount = await seedAnalyticsEvents(
      prisma,
      tenant.id,
      users['learner']?.id ?? users['admin']?.id ?? '',
    );
    summary['Analytics Events'] = analyticsCount;

    // ── Step 15: Seed Audit Logs ─────────────────────────────────────────────
    console.log('');
    console.log('▸ Seeding audit logs...');

    const auditCount = await seedAuditLogs(
      prisma,
      tenant.id,
      users['admin']?.id ?? '',
    );
    summary['Audit Logs'] = auditCount;

    // ── Print Summary ────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  LMS Validation Seed - Summary');
    console.log('═══════════════════════════════════════');
    console.log(`  Tenant:              ${summary['Tenants']} (${TENANT_SUBDOMAIN})`);
    console.log(`  Users:               ${summary['Users']} (admin, instructor, learner, employee-only)`);
    console.log(`  Departments:         ${summary['Departments']}`);
    console.log(`  Designations:        ${summary['Designations']}`);
    console.log(`  Employee Profiles:   ${summary['Employee Profiles']}`);
    console.log(`  Categories:          ${summary['Categories']}`);
    console.log(`  Courses:             ${summary['Courses']} (1 published, 1 review, 1 draft)`);
    console.log(`  Modules:             ${summary['Modules']}`);
    console.log(`  Lessons:             ${summary['Lessons']}`);
    console.log(`  Assessments:         ${summary['Assessments']}`);
    console.log(`  Questions:           ${summary['Questions']}`);
    console.log(`  Certificate Tmpl:    ${summary['Certificate Templates']}`);
    console.log(`  Documents:           ${summary['Documents']}`);
    console.log(`  Document Categories: ${summary['Document Categories']}`);
    console.log(`  Document Versions:   ${summary['Document Versions']}`);
    console.log(`  Projects:            ${summary['Projects']}`);
    console.log(`  Milestones:          ${summary['Milestones']}`);
    console.log(`  Project Members:     ${summary['Project Members']}`);
    console.log(`  Analytics Events:    ${summary['Analytics Events']}`);
    console.log(`  Audit Logs:          ${summary['Audit Logs']}`);
    console.log('═══════════════════════════════════════');
    console.log(`  Seed completed in ${elapsed}s`);
    console.log('═══════════════════════════════════════');
    console.log('');

    // Build complete SeedResult for downstream workflow tests
    const result: SeedResult = {
      tenant,
      users: {
        admin: users['admin']!,
        instructor: users['instructor']!,
        learner: users['learner']!,
        employeeOnly: users['employeeOnly'] ?? undefined,
      },
      departments: { parentId: parentDeptId, childId: childDeptId },
      designations: { seniorId: seniorDesignationId, juniorId: juniorDesignationId },
      categories: categoryIds,
      courses: {
        publishedId: publishedCourseId,
        reviewId: reviewCourseId,
        draftId: draftCourseId,
      },
      assessments: assessmentResults,
      certificateTemplateId,
      documents: documentIds,
      documentCategories: docCategories.map((c) => c.id),
      project: {
        id: projectResult?.id ?? '',
        milestoneIds: projectResult?.milestoneIds ?? [],
      },
      summary,
    };

    // Write SeedResult as JSON file for downstream workflow runner consumption
    const resultFilePath = path.resolve(__dirname, '../../../.validation-seed-result.json');
    fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  Seed result written to: ${resultFilePath}`);
    console.log('');

    // Also write result to stdout as JSON for downstream consumption
    console.log('SEED_RESULT_JSON:' + JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
