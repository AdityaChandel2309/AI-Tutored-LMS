import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import type { DomainEvent } from '../events/domain-events';

describe('AnalyticsService', () => {
  type PrismaMock = {
    analyticsEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    user: { findFirst: jest.Mock };
  };

  const prisma: PrismaMock = {
    analyticsEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: { findFirst: jest.fn() },
  };

  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  // ─── persistEvent ─────────────────────────

  describe('persistEvent', () => {
    const baseEvent: DomainEvent = {
      type: 'enrollment.created',
      tenantId: 'tenant-1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      actorId: 'user-1',
      entityId: 'enrollment-1',
      entityType: 'enrollment',
      payload: {
        enrollmentId: 'enrollment-1',
        userId: 'user-1',
        courseId: 'course-1',
      },
    };

    it('persists an event with all fields', async () => {
      prisma.analyticsEvent.create.mockResolvedValue({});

      await service.persistEvent(baseEvent);

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          actorId: 'user-1',
          type: 'enrollment.created',
          entityId: 'enrollment-1',
          entityType: 'enrollment',
          occurredAt: baseEvent.timestamp,
          payload: baseEvent.payload,
        },
      });
    });

    it('handles missing optional fields gracefully', async () => {
      prisma.analyticsEvent.create.mockResolvedValue({});

      const minimalEvent: DomainEvent = {
        type: 'course.published',
        tenantId: 'tenant-1',
        timestamp: new Date(),
        payload: { courseId: 'c1' },
      };

      await service.persistEvent(minimalEvent);

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: null,
          entityId: null,
          entityType: null,
        }),
      });
    });

    it('does not throw when persistence fails', async () => {
      prisma.analyticsEvent.create.mockRejectedValue(new Error('DB down'));

      await expect(service.persistEvent(baseEvent)).resolves.toBeUndefined();
    });
  });

  // ─── getActivityTimeline ──────────────────

  describe('getActivityTimeline', () => {
    const mockUser = {
      id: 'db-user-1',
      keycloakId: 'kc-1',
      tenantId: 'tenant-1',
    };

    it('returns paginated activity for a user', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.analyticsEvent.findMany.mockResolvedValue([
        { id: 'e1', type: 'lesson.completed', occurredAt: new Date() },
      ]);
      prisma.analyticsEvent.count.mockResolvedValue(1);

      const result = await service.getActivityTimeline({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        take: 10,
        skip: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.take).toBe(10);
    });

    it('filters by event type when provided', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.analyticsEvent.findMany.mockResolvedValue([]);
      prisma.analyticsEvent.count.mockResolvedValue(0);

      await service.getActivityTimeline({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        type: 'assessment.passed',
      });

      expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'assessment.passed' }),
        }),
      );
    });

    it('throws ForbiddenException when tenantId is null', async () => {
      await expect(
        service.getActivityTimeline({ tenantId: null, authUserId: 'kc-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getActivityTimeline({
          tenantId: 'tenant-1',
          authUserId: 'kc-unknown',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('caps take at 100', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.analyticsEvent.findMany.mockResolvedValue([]);
      prisma.analyticsEvent.count.mockResolvedValue(0);

      await service.getActivityTimeline({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        take: 500,
      });

      expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ─── Reporting: getCompletionCounts ───────

  describe('getCompletionCounts', () => {
    it('returns count of course.completed events', async () => {
      prisma.analyticsEvent.count.mockResolvedValue(5);

      const result = await service.getCompletionCounts({
        tenantId: 'tenant-1',
      });

      expect(result).toEqual({ type: 'course.completed', count: 5 });
    });

    it('throws when tenantId is null', async () => {
      await expect(
        service.getCompletionCounts({ tenantId: null }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Reporting: getPassRates ──────────────

  describe('getPassRates', () => {
    it('calculates pass rate correctly', async () => {
      prisma.analyticsEvent.count
        .mockResolvedValueOnce(10) // attempted
        .mockResolvedValueOnce(7); // passed

      const result = await service.getPassRates({ tenantId: 'tenant-1' });

      expect(result).toEqual({ attempted: 10, passed: 7, passRate: 70 });
    });

    it('returns 0 pass rate when no attempts', async () => {
      prisma.analyticsEvent.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getPassRates({ tenantId: 'tenant-1' });

      expect(result.passRate).toBe(0);
    });
  });

  // ─── Reporting: getEnrollmentCounts ───────

  describe('getEnrollmentCounts', () => {
    it('returns count of enrollment.created events', async () => {
      prisma.analyticsEvent.count.mockResolvedValue(12);

      const result = await service.getEnrollmentCounts({
        tenantId: 'tenant-1',
      });

      expect(result).toEqual({ type: 'enrollment.created', count: 12 });
    });
  });

  // ─── Reporting: getCertificateCounts ──────

  describe('getCertificateCounts', () => {
    it('returns count of certificate.issued events', async () => {
      prisma.analyticsEvent.count.mockResolvedValue(3);

      const result = await service.getCertificateCounts({
        tenantId: 'tenant-1',
      });

      expect(result).toEqual({ type: 'certificate.issued', count: 3 });
    });
  });

  // ─── Tenant isolation ─────────────────────

  describe('tenant isolation', () => {
    it('always includes tenantId in report queries', async () => {
      prisma.analyticsEvent.count.mockResolvedValue(0);

      await service.getCompletionCounts({
        tenantId: 'tenant-A',
        from: new Date('2026-01-01'),
        to: new Date('2026-12-31'),
      });

      expect(prisma.analyticsEvent.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: 'tenant-A' }),
      });
    });
  });
});
