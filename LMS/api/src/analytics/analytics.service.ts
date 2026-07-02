import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DomainEvent } from '../events/domain-events';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a domain event as an AnalyticsEvent row.
   * Called synchronously from the analytics listener.
   * Payload is stored as native Json (not stringified text).
   */
  async persistEvent(event: DomainEvent): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          tenantId: event.tenantId,
          actorId: event.actorId ?? null,
          type: event.type,
          entityId: event.entityId ?? null,
          entityType: event.entityType ?? null,
          occurredAt: event.timestamp,
          payload: event.payload as any,
        },
      });
    } catch (err) {
      // Analytics persistence should never break the main flow
      this.logger.warn(
        `Failed to persist analytics event [${event.type}]: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Get a paginated activity timeline for a specific learner.
   */
  async getActivityTimeline(input: {
    tenantId: string | null;
    authUserId: string;
    take?: number;
    skip?: number;
    type?: string;
  }) {
    const { tenantId, authUserId, take = 20, skip = 0, type } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found in current tenant');
    }

    const where: Record<string, unknown> = {
      tenantId,
      actorId: user.id,
    };

    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: Math.min(take, 100),
        skip,
      }),
      this.prisma.analyticsEvent.count({ where }),
    ]);

    return { items, total, take, skip };
  }

  // ─── Reporting Primitives ──────────────────

  async getCompletionCounts(input: {
    tenantId: string | null;
    courseId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { tenantId, courseId, from, to } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const where = this.buildReportWhere(
      tenantId,
      'course.completed',
      courseId,
      from,
      to,
    );

    const count = await this.prisma.analyticsEvent.count({ where });

    return { type: 'course.completed', count };
  }

  async getPassRates(input: {
    tenantId: string | null;
    courseId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { tenantId, courseId, from, to } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const attemptedWhere = this.buildReportWhere(
      tenantId,
      'assessment.attempted',
      courseId,
      from,
      to,
    );

    const passedWhere = this.buildReportWhere(
      tenantId,
      'assessment.passed',
      courseId,
      from,
      to,
    );

    const [attempted, passed] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: attemptedWhere }),
      this.prisma.analyticsEvent.count({ where: passedWhere }),
    ]);

    const passRate = attempted > 0 ? Math.round((passed / attempted) * 100) : 0;

    return { attempted, passed, passRate };
  }

  async getEnrollmentCounts(input: {
    tenantId: string | null;
    courseId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { tenantId, courseId, from, to } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const where = this.buildReportWhere(
      tenantId,
      'enrollment.created',
      courseId,
      from,
      to,
    );

    const count = await this.prisma.analyticsEvent.count({ where });

    return { type: 'enrollment.created', count };
  }

  async getCertificateCounts(input: {
    tenantId: string | null;
    courseId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { tenantId, courseId, from, to } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const where = this.buildReportWhere(
      tenantId,
      'certificate.issued',
      courseId,
      from,
      to,
    );

    const count = await this.prisma.analyticsEvent.count({ where });

    return { type: 'certificate.issued', count };
  }

  /**
   * Single optimized query for dashboard summary cards.
   * Runs all counts in parallel to minimize latency.
   */
  async getDashboardSummary(tenantId: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const [totalCourses, totalUsers, totalEnrollments, completions, certificates, activeCourses] = await Promise.all([
      this.prisma.course.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.enrollment.count({ where: { course: { tenantId } } }),
      this.prisma.enrollment.count({ where: { course: { tenantId }, completedAt: { not: null } } }),
      this.prisma.issuedCertificate.count({ where: { tenantId } }),
      this.prisma.course.count({ where: { tenantId, status: 'published' } }),
    ]);

    return {
      totalCourses,
      activeCourses,
      totalUsers,
      totalEnrollments,
      completions,
      certificates,
      completionRate: totalEnrollments > 0 ? Math.round((completions / totalEnrollments) * 100) : 0,
    };
  }

  // ─── Private helpers ───────────────────────

  private buildReportWhere(
    tenantId: string,
    type: string,
    courseId?: string,
    from?: Date,
    to?: Date,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {
      tenantId,
      type,
    };

    if (from || to) {
      const occurredAt: Record<string, Date> = {};
      if (from) occurredAt.gte = from;
      if (to) occurredAt.lte = to;
      where.occurredAt = occurredAt;
    }

    // Filter by courseId through the payload JSON if provided
    if (courseId) {
      where.payload = {
        path: ['courseId'],
        equals: courseId,
      };
    }

    return where;
  }
}
