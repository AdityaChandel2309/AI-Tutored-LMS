import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { EventBus } from '../events/event-bus';

type PrismaMock = {
  $transaction: jest.Mock;
  project: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  projectMember: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  milestone: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  user: { findFirst: jest.Mock };
};

const prisma: PrismaMock = {
  $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(prisma)),
  project: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  milestone: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: { findFirst: jest.fn() },
};

const eventBus = { emit: jest.fn() };
let service: ProjectService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new ProjectService(
    prisma as any,
    eventBus as unknown as EventBus,
  );
});

describe('ProjectService', () => {
  // ─── addMember ───────────────────────────────
  describe('addMember', () => {
    it('throws ForbiddenException when tenant is null', async () => {
      await expect(service.addMember(null, 'proj-1', { userId: 'u1', role: 'member' }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when project is missing', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.addMember('t1', 'proj-1', { userId: 'u1', role: 'member' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when user is already a member (M2)', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm-1' });

      await expect(service.addMember('t1', 'proj-1', { userId: 'u1', role: 'member' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('creates member when not duplicate', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.projectMember.findUnique.mockResolvedValue(null);
      prisma.projectMember.create.mockResolvedValue({ id: 'pm-1', projectId: 'proj-1', userId: 'u1', role: 'member' });

      const result = await service.addMember('t1', 'proj-1', { userId: 'u1', role: 'member' });

      expect(prisma.projectMember.create).toHaveBeenCalled();
      expect(result.id).toBe('pm-1');
    });
  });

  // ─── removeMember ────────────────────────────
  describe('removeMember', () => {
    it('throws NotFoundException when member does not exist (M1)', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('t1', 'proj-1', 'u1'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes member when found', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm-1', projectId: 'proj-1', userId: 'u1' });
      prisma.projectMember.delete.mockResolvedValue({ id: 'pm-1' });

      const result = await service.removeMember('t1', 'proj-1', 'u1');

      expect(prisma.projectMember.delete).toHaveBeenCalled();
      expect(result.id).toBe('pm-1');
    });
  });

  // ─── updateStatus ────────────────────────────
  describe('updateStatus', () => {
    it('rejects invalid status transition', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', status: 'completed' });

      await expect(service.updateStatus('t1', 'proj-1', { status: 'active' }, 'actor-1'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts valid status transition', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', status: 'planning' });
      prisma.project.update.mockResolvedValue({ id: 'proj-1', status: 'active' });

      const result = await service.updateStatus('t1', 'proj-1', { status: 'active' }, 'actor-1');

      expect(prisma.project.update).toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'project.status_changed' }),
      );
      expect(result.status).toBe('active');
    });

    it('sets actualEndDate on completion', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', status: 'active' });
      prisma.project.update.mockResolvedValue({ id: 'proj-1', status: 'completed', actualEndDate: new Date() });

      await service.updateStatus('t1', 'proj-1', { status: 'completed' }, 'actor-1');

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actualEndDate: expect.any(Date) }),
        }),
      );
    });
  });

  // ─── createProject ───────────────────────────
  describe('createProject', () => {
    it('creates project and adds owner as member', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.project.create.mockResolvedValue({ id: 'proj-1', title: 'Test' });
      prisma.projectMember.create.mockResolvedValue({ id: 'pm-1' });

      const result = await service.createProject('t1', { title: 'Test' }, 'kc-1');

      expect(prisma.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', role: 'owner' }),
        }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'project.created' }),
      );
      expect(result.id).toBe('proj-1');
    });
  });
});
