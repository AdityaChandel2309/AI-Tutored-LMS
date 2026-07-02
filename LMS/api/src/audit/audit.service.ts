import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/logger/structured-logger';

export interface AuditLogData {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: AuditLogData): Promise<void> {
    const ctx = requestContext.getStore();
    
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx?.tenantId || 'system',
        actorId: ctx?.userId || null,
        action: data.action,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        metadata: data.metadata || undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  }

  async findMany(params: {
    tenantId: string;
    actorId?: string;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { tenantId: params.tenantId };
    
    if (params.actorId) where.actorId = params.actorId;
    if (params.action) where.action = params.action;
    if (params.entityType) where.entityType = params.entityType;
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}