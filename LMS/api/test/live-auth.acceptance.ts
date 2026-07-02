import { strict as assert } from 'assert';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  getKeycloakAdminToken,
  provisionKeycloak,
  waitForKeycloakReady,
} from '../src/scripts/keycloak-provisioning';

type KeycloakTokenResponse = {
  access_token: string;
  refresh_token?: string;
};

type KeycloakUser = {
  id: string;
  username: string;
  email?: string;
};

type ResponseEnvelope<T> = {
  data: T;
  meta?: { path?: string; timestamp?: string };
};

function getData<T>(body: unknown): T {
  return (body as ResponseEnvelope<T>).data;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, '$1');

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env'));
  loadEnvFile(resolve(process.cwd(), '../.env'));

  const keycloakBaseUrl =
    process.env.KEYCLOAK_BASE_URL ?? 'http://localhost:8080';
  const keycloakRealm = process.env.KEYCLOAK_REALM ?? 'LMS';
  const runId = Date.now().toString();
  const adminEmail = `live-admin-${runId}@example.com`;
  const learnerEmail = `live-learner-${runId}@example.com`;
  const managedEmail = `live-managed-${runId}@example.com`;
  const userPassword = 'LivePass123!';
  const createdUserIds: string[] = [];

  let app: INestApplication<App> | null = null;

  try {
    console.log('Waiting for Keycloak...');
    await waitForKeycloakReady(keycloakBaseUrl);

    console.log('Applying repo-owned Keycloak realm/client provisioning...');
    const adminToken = await getKeycloakAdminToken();
    const provisioned = await provisionKeycloak();
    const clientSecret = provisioned.clientSecret;
    const clientId = provisioned.clientId;
    process.env.KEYCLOAK_CLIENT_SECRET = clientSecret;

    await ensureUserWithRoles({
      email: adminEmail,
      password: userPassword,
      roles: ['admin'],
    });
    await ensureUserWithRoles({
      email: learnerEmail,
      password: userPassword,
      roles: ['learner'],
    });

    const adminUserToken = await getUserToken(
      adminEmail,
      userPassword,
      clientSecret,
    );
    const learnerUserToken = await getUserToken(
      learnerEmail,
      userPassword,
      clientSecret,
    );

    console.log('Booting Nest app for acceptance checks...');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const prisma = app.get(PrismaService);
    await prisma.tenant.upsert({
      where: { subdomain: 'default' },
      update: { name: 'Default LMS' },
      create: {
        name: 'Default LMS',
        subdomain: 'default',
      },
    });

    console.log('Running live acceptance checks...');

    const meResponse = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .expect(200);

    const meData = getData<{
      email: string;
      roles: string[];
      tenantId: string | null;
    }>(meResponse.body);
    assert.equal(meData.email, adminEmail);
    assert.ok(meData.roles.includes('admin'));
    assert.ok(meData.tenantId);

    const profileResponse = await request(app.getHttpServer())
      .patch('/me/profile')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .send({
        firstName: 'Live',
        lastName: 'Admin',
      })
      .expect(200);

    const profileData = getData<{
      firstName?: string | null;
      lastName?: string | null;
    }>(profileResponse.body);
    assert.equal(profileData.firstName, 'Live');
    assert.equal(profileData.lastName, 'Admin');

    const avatarResponse = await request(app.getHttpServer())
      .post('/me/avatar')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .attach('file', Buffer.from('avatar-test'), 'avatar.jpg')
      .expect(201);

    const avatarData = getData<{
      avatarUrl?: string | null;
    }>(avatarResponse.body);
    assert.ok(avatarData.avatarUrl?.includes('/lms-avatars/avatars/'));

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${learnerUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .expect(403);

    const createResponse = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .send({
        email: managedEmail,
        firstName: 'Live',
        lastName: 'Managed',
        temporaryPassword: userPassword,
        roles: ['instructor'],
      })
      .expect(201);

    const createData = getData<{
      id: string;
      email: string;
      roles: string[];
    }>(createResponse.body);
    const createdUserId = createData.id;
    assert.equal(createData.email, managedEmail);
    assert.deepEqual(createData.roles, ['instructor']);

    const listResponse = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .expect(200);

    const listData = getData<Array<{ email: string }>>(listResponse.body);
    assert.ok(listData.some((user) => user.email === managedEmail));

    const updateResponse = await request(app.getHttpServer())
      .patch(`/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .send({
        roles: ['learner'],
      })
      .expect(200);

    const updateData = getData<{ roles: string[] }>(updateResponse.body);
    assert.deepEqual(updateData.roles, ['learner']);

    const deactivateResponse = await request(app.getHttpServer())
      .patch(`/users/${createdUserId}/deactivate`)
      .set('Authorization', `Bearer ${adminUserToken}`)
      .set('x-tenant-subdomain', 'default')
      .expect(200);

    const deactivateData = getData<{ isActive: boolean }>(
      deactivateResponse.body,
    );
    assert.equal(deactivateData.isActive, false);

    console.log('Live acceptance checks passed.');

    async function ensureUserWithRoles(input: {
      email: string;
      password: string;
      roles: string[];
    }) {
      const user = await ensureUser(input);
      const roleRepresentations = await Promise.all(
        input.roles.map(async (roleName) => {
          const response = await axios.get<{
            id: string;
            name: string;
          }>(
            `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/roles/${roleName}`,
            {
              headers: {
                Authorization: `Bearer ${adminToken}`,
              },
            },
          );

          return response.data;
        }),
      );

      await axios.post(
        `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users/${user.id}/role-mappings/realm`,
        roleRepresentations,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      return user;
    }

    async function ensureUser(input: { email: string; password: string }) {
      const existingUserResponse = await axios.get<KeycloakUser[]>(
        `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users`,
        {
          params: { username: input.email },
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      const existingUser = existingUserResponse.data.find(
        (user) => user.username === input.email,
      );

      if (existingUser) {
        createdUserIds.push(existingUser.id);
        await fullySetupUser(existingUser.id, input.email, input.password);

        return existingUser;
      }

      await axios.post(
        `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users`,
        {
          email: input.email,
          username: input.email,
          firstName: 'Live',
          lastName: 'User',
          enabled: true,
          emailVerified: true,
          credentials: [
            {
              type: 'password',
              value: input.password,
              temporary: false,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      const createdUserResponse = await axios.get<KeycloakUser[]>(
        `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users`,
        {
          params: { username: input.email },
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      const createdUser = createdUserResponse.data.find(
        (user) => user.username === input.email,
      );

      if (!createdUser) {
        throw new Error(`Failed to create Keycloak user ${input.email}`);
      }

      createdUserIds.push(createdUser.id);
      await fullySetupUser(createdUser.id, input.email, input.password);
      return createdUser;
    }

    async function fullySetupUser(
      userId: string,
      email: string,
      password: string,
    ) {
      await axios.put(
        `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users/${userId}`,
        {
          id: userId,
          username: email,
          email,
          firstName: 'Live',
          lastName: 'User',
          enabled: true,
          emailVerified: true,
          requiredActions: [],
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );

      await axios.put(
        `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users/${userId}/reset-password`,
        {
          type: 'password',
          value: password,
          temporary: false,
        },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        },
      );
    }

    async function getUserToken(
      username: string,
      password: string,
      clientSecret: string,
    ) {
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('username', username);
      params.append('password', password);

      const response = await axios.post<KeycloakTokenResponse>(
        `${keycloakBaseUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
    }
  } finally {
    if (createdUserIds.length > 0) {
      try {
        const cleanupToken = await getKeycloakAdminToken();

        for (const userId of createdUserIds) {
          try {
            await axios.delete(
              `${keycloakBaseUrl}/admin/realms/${keycloakRealm}/users/${userId}`,
              {
                headers: {
                  Authorization: `Bearer ${cleanupToken}`,
                },
              },
            );
          } catch {
            // Ignore cleanup failures.
          }
        }
      } catch {
        // Ignore cleanup token failures.
      }
    }

    if (app) {
      await app.close();
    }
  }
}

main().catch((error) => {
  console.error('Live acceptance failed:', error);
  process.exit(1);
});
