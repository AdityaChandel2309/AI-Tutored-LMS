/**
 * Seed Users Script
 * Creates 4 demo users in Keycloak + local LMS database.
 *
 * Users created:
 *  1. super.admin@lms.dev  — roles: super_admin, admin, instructor, learner, employee
 *  2. admin@lms.dev        — roles: admin, learner, employee
 *  3. instructor@lms.dev   — roles: instructor, learner, employee
 *  4. learner@lms.dev      — roles: learner, employee
 *
 * Run with:
 *   cd api && npx ts-node -r tsconfig-paths/register src/scripts/seed-users.ts
 */

import axios from 'axios';
import { loadProjectEnv } from '../env';
import { waitForKeycloakReady, getKeycloakAdminToken } from './keycloak-provisioning';
import { PrismaClient } from '@prisma/client';

loadProjectEnv();

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_INTERNAL_URL ?? 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? 'LMS';
const DEFAULT_PASSWORD = 'Admin@1234';

interface UserSeed {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  roles: string[];         // Keycloak realm roles
  dbRoles: string[];       // Roles stored in DB
}

const USERS_TO_SEED: UserSeed[] = [
  {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'super.admin@lms.dev',
    username: 'super.admin',
    roles: ['super_admin', 'admin', 'instructor', 'learner'],
    dbRoles: ['super_admin', 'admin', 'instructor', 'learner', 'employee'],
  },
  {
    firstName: 'Company',
    lastName: 'Admin',
    email: 'admin@lms.dev',
    username: 'admin',
    roles: ['admin', 'learner'],
    dbRoles: ['admin', 'learner', 'employee'],
  },
  {
    firstName: 'Jane',
    lastName: 'Instructor',
    email: 'instructor@lms.dev',
    username: 'instructor',
    roles: ['instructor', 'learner'],
    dbRoles: ['instructor', 'learner', 'employee'],
  },
  {
    firstName: 'John',
    lastName: 'Learner',
    email: 'learner@lms.dev',
    username: 'learner',
    roles: ['learner'],
    dbRoles: ['learner', 'employee'],
  },
];

async function createOrUpdateKeycloakUser(
  adminToken: string,
  user: UserSeed,
): Promise<string> {
  // Check if user already exists
  const existingRes = await axios.get<Array<{ id: string }>>(
    `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
    {
      params: { username: user.username, exact: true },
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );

  let keycloakId: string;

  if (existingRes.data.length > 0) {
    keycloakId = existingRes.data[0].id;
    console.log(`  ✔ User "${user.username}" already exists in Keycloak (${keycloakId})`);

    // Update existing user
    await axios.put(
      `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakId}`,
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        enabled: true,
        emailVerified: true,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
  } else {
    // Create new user
    await axios.post(
      `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        enabled: true,
        emailVerified: true,
        credentials: [
          {
            type: 'password',
            value: DEFAULT_PASSWORD,
            temporary: false,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );

    const createdRes = await axios.get<Array<{ id: string }>>(
      `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        params: { username: user.username, exact: true },
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    keycloakId = createdRes.data[0].id;
    console.log(`  ✔ Created Keycloak user "${user.username}" (${keycloakId})`);
  }

  // Assign realm roles
  const allRolesRes = await axios.get<Array<{ id: string; name: string }>>(
    `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/roles`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );

  const rolesToAssign = allRolesRes.data.filter((r) =>
    user.roles.includes(r.name),
  );

  if (rolesToAssign.length > 0) {
    await axios.post(
      `${KEYCLOAK_BASE_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakId}/role-mappings/realm`,
      rolesToAssign,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    console.log(`  ✔ Assigned roles [${rolesToAssign.map((r) => r.name).join(', ')}] to "${user.username}"`);
  }

  return keycloakId;
}

async function upsertDbUser(
  prisma: PrismaClient,
  tenantId: string,
  user: UserSeed,
  keycloakId: string,
) {
  const dbUser = await prisma.user.upsert({
    where: { keycloakId },
    create: {
      keycloakId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.dbRoles,
      isActive: true,
      tenantId,
    },
    update: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.dbRoles,
      isActive: true,  // always re-activate on re-seed
      tenantId,
    },
  });

  console.log(`  ✔ Upserted DB user "${user.email}" (${dbUser.id})`);
  return dbUser;
}

async function main() {
  console.log('\n🔍 Waiting for Keycloak to be ready...');
  await waitForKeycloakReady(KEYCLOAK_BASE_URL);
  console.log('✅ Keycloak is ready.\n');

  const adminToken = await getKeycloakAdminToken();
  const prisma = new PrismaClient();
  await prisma.$connect();

  // Ensure default tenant exists
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'default' },
    create: { name: 'Default Company', subdomain: 'default' },
    update: { name: 'Default Company' },
  });
  console.log(`✅ Tenant ready: "${tenant.name}" (${tenant.id})\n`);

  for (const user of USERS_TO_SEED) {
    console.log(`\n👤 Seeding user: ${user.email}`);
    const keycloakId = await createOrUpdateKeycloakUser(adminToken, user);
    await upsertDbUser(prisma, tenant.id, user, keycloakId);
  }

  await prisma.$disconnect();

  console.log(`
✅ Done! All users seeded successfully.

📋 Login Credentials (all users share the same password):
┌──────────────────────────┬──────────────┬─────────────────────────────────────────────┐
│ Email                    │ Password     │ Roles                                       │
├──────────────────────────┼──────────────┼─────────────────────────────────────────────┤
│ super.admin@lms.dev      │ Admin@1234   │ super_admin, admin, instructor, learner     │
│ admin@lms.dev            │ Admin@1234   │ admin, learner, employee                    │
│ instructor@lms.dev       │ Admin@1234   │ instructor, learner, employee               │
│ learner@lms.dev          │ Admin@1234   │ learner, employee                           │
└──────────────────────────┴──────────────┴─────────────────────────────────────────────┘

🌐 App URL: http://localhost:3001
`);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err?.response?.data ?? err.message ?? err);
  process.exit(1);
});
