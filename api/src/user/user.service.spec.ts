import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const authService = {
    createKeycloakUser: jest.fn(),
    updateUserRoles: jest.fn(),
    deactivateUser: jest.fn(),
  };

  let service: UserService;

  beforeEach(() => {
    prisma.user.findMany.mockReset();
    prisma.user.count.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.findFirst.mockReset();
    prisma.user.create.mockReset();
    prisma.user.update.mockReset();
    authService.createKeycloakUser.mockReset();
    authService.updateUserRoles.mockReset();
    authService.deactivateUser.mockReset();

    service = new UserService(prisma as never, authService as never);
  });

  it('rejects user listing when the tenant is missing', async () => {
    await expect(service.getUsers(null)).rejects.toThrow(
      new ForbiddenException('Tenant could not be resolved'),
    );
  });

  it('lists users for the current tenant', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    const result = await service.getUsers('tenant-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      skip: 0,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
    });
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 50 });
  });

  it('rejects create when the email already exists locally', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
    });

    await expect(
      service.createUser('tenant-1', {
        email: 'admin@example.com',
        temporaryPassword: 'Temp123!',
        roles: ['admin'],
      }),
    ).rejects.toThrow(new ConflictException('User already exists in LMS'));
  });

  it('creates a tenant user after Keycloak creation succeeds', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    authService.createKeycloakUser.mockResolvedValue({
      keycloakUserId: 'kc-1',
      roles: ['admin'],
    });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      tenantId: 'tenant-1',
    });

    const result = await service.createUser('tenant-1', {
      email: 'admin@example.com',
      temporaryPassword: 'Temp123!',
      roles: ['admin'],
    });

    expect(authService.createKeycloakUser).toHaveBeenCalledWith({
      email: 'admin@example.com',
      temporaryPassword: 'Temp123!',
      roles: ['admin'],
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        keycloakId: 'kc-1',
        email: 'admin@example.com',
        roles: ['admin'],
        tenantId: 'tenant-1',
      },
    });
    expect(result.id).toBe('user-1');
  });

  it('syncs roles through Keycloak before persisting them locally', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      keycloakId: 'kc-1',
      tenantId: 'tenant-1',
    });
    authService.updateUserRoles.mockResolvedValue(['instructor']);
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      roles: ['instructor'],
    });

    const result = await service.updateUserRole('tenant-1', 'user-1', [
      'instructor',
    ]);

    expect(authService.updateUserRoles).toHaveBeenCalledWith('kc-1', [
      'instructor',
    ]);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { roles: ['instructor'] },
    });
    expect(result.roles).toEqual(['instructor']);
  });

  it('rejects role updates for users outside the current tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.updateUserRole('tenant-1', 'user-1', ['admin']),
    ).rejects.toThrow(
      new NotFoundException('User not found in current tenant'),
    );
  });

  it('deactivates a tenant user in Keycloak and locally', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      keycloakId: 'kc-1',
      tenantId: 'tenant-1',
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      isActive: false,
    });

    const result = await service.deactivateUser('tenant-1', 'user-1');

    expect(authService.deactivateUser).toHaveBeenCalledWith('kc-1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });
});
