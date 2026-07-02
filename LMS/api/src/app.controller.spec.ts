import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';

describe('AppController', () => {
  let appController: AppController;
  const appService = {
    getHello: jest.fn(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const storageService = {
    uploadAvatar: jest.fn(),
  };

  beforeEach(async () => {
    appService.getHello.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.create.mockReset();
    prisma.user.update.mockReset();
    storageService.uploadAvatar.mockReset();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      appService.getHello.mockReturnValue('Hello World!');

      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getMe', () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Tenant One',
      subdomain: 'tenant-one',
      createdAt: new Date(),
    };

    const authUser = {
      userId: 'kc-1',
      email: 'admin@example.com',
      roles: ['admin'],
      tenantId: tenant.id,
    };

    it('throws when the authenticated user context is missing', async () => {
      await expect(
        appController.getMe({
          tenant,
        } as never),
      ).rejects.toThrow(
        new ForbiddenException('Authenticated user context missing'),
      );
    });

    it('throws when the tenant cannot be resolved', async () => {
      await expect(
        appController.getMe({
          user: authUser,
        } as never),
      ).rejects.toThrow(new ForbiddenException('Tenant could not be resolved'));
    });

    it('creates a new user inside the resolved tenant', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        keycloakId: authUser.userId,
        email: authUser.email,
        roles: authUser.roles,
        tenantId: tenant.id,
      });

      const result = await appController.getMe({
        user: authUser,
        tenant,
      } as never);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          keycloakId: authUser.userId,
          email: authUser.email,
          roles: authUser.roles,
          tenantId: tenant.id,
        },
      });
      expect(result.tenantId).toBe(tenant.id);
    });

    it('blocks inactive users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        keycloakId: authUser.userId,
        email: authUser.email,
        roles: authUser.roles,
        tenantId: tenant.id,
        isActive: false,
      });

      await expect(
        appController.getMe({
          user: authUser,
          tenant,
        } as never),
      ).rejects.toThrow(new ForbiddenException('User is inactive'));
    });

    it('blocks users from a different tenant', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        keycloakId: authUser.userId,
        email: authUser.email,
        roles: authUser.roles,
        tenantId: 'tenant-2',
        isActive: true,
      });

      await expect(
        appController.getMe({
          user: authUser,
          tenant,
        } as never),
      ).rejects.toThrow(
        new ForbiddenException('User does not belong to the resolved tenant'),
      );
    });

    it('syncs email and roles for an active tenant user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        keycloakId: authUser.userId,
        email: 'old@example.com',
        roles: ['learner'],
        tenantId: tenant.id,
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        keycloakId: authUser.userId,
        email: authUser.email,
        roles: authUser.roles,
        tenantId: tenant.id,
        isActive: true,
      });

      const result = await appController.getMe({
        user: authUser,
        tenant,
      } as never);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { keycloakId: authUser.userId },
        data: {
          email: authUser.email,
          roles: authUser.roles,
        },
      });
      expect(result.roles).toEqual(['admin']);
    });
  });

  describe('updateProfile', () => {
    it('updates first and last name for the resolved user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        keycloakId: 'kc-1',
        tenantId: 'tenant-1',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      const result = await appController.updateProfile(
        {
          user: {
            userId: 'kc-1',
            email: 'ada@example.com',
            roles: ['learner'],
            tenantId: 'tenant-1',
          },
          tenant: {
            id: 'tenant-1',
          },
        } as never,
        {
          firstName: ' Ada ',
          lastName: ' Lovelace ',
        },
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
      });
      expect(result.firstName).toBe('Ada');
    });
  });

  describe('uploadAvatar', () => {
    it('uploads an avatar and stores the returned URL', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        keycloakId: 'kc-1',
        tenantId: 'tenant-1',
        isActive: true,
      });
      storageService.uploadAvatar.mockResolvedValue(
        'http://localhost:9000/lms-avatars/avatars/user-1.jpg',
      );
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        avatarUrl: 'http://localhost:9000/lms-avatars/avatars/user-1.jpg',
      });

      const result = await appController.uploadAvatar(
        {
          user: {
            userId: 'kc-1',
            email: 'ada@example.com',
            roles: ['learner'],
            tenantId: 'tenant-1',
          },
          tenant: {
            id: 'tenant-1',
          },
        } as never,
        {
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('avatar'),
        },
      );

      expect(storageService.uploadAvatar).toHaveBeenCalledWith({
        userId: 'user-1',
        fileName: 'avatar.jpg',
        contentType: 'image/jpeg',
        body: Buffer.from('avatar'),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          avatarUrl: 'http://localhost:9000/lms-avatars/avatars/user-1.jpg',
        },
      });
      expect(result.avatarUrl).toContain('lms-avatars');
    });
  });
});
