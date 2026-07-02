import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: {
    userId: string;
    tenantId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async listNotifications(input: {
    tenantId: string | null;
    authUserId: string;
    take?: number;
    skip?: number;
  }) {
    const { tenantId, authUserId, take = 20, skip = 0 } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.resolveUser(tenantId, authUserId);

    return this.prisma.notification.findMany({
      where: { userId: user.id, tenantId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  async getUnreadCount(input: { tenantId: string | null; authUserId: string }) {
    const { tenantId, authUserId } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.resolveUser(tenantId, authUserId);

    const count = await this.prisma.notification.count({
      where: { userId: user.id, tenantId, isRead: false },
    });

    return { unreadCount: count };
  }

  async markAsRead(input: {
    tenantId: string | null;
    authUserId: string;
    notificationId: string;
  }) {
    const { tenantId, authUserId, notificationId } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.resolveUser(tenantId, authUserId);

    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id, tenantId },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(input: { tenantId: string | null; authUserId: string }) {
    const { tenantId, authUserId } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.resolveUser(tenantId, authUserId);

    const { count } = await this.prisma.notification.updateMany({
      where: { userId: user.id, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { markedCount: count };
  }

  private async resolveUser(tenantId: string, authUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });
    if (!user) throw new ForbiddenException('User not found');
    return user;
  }
}
