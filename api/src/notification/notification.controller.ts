import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my/notifications')
  @ApiOperation({ summary: 'List my notifications (paginated, newest first)' })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  listNotifications(
    @Request() req: TenantAwareRequest,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.notificationService.listNotifications({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/notifications/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@Request() req: TenantAwareRequest) {
    return this.notificationService.getUnreadCount({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(
    @Request() req: TenantAwareRequest,
    @Param('id') notificationId: string,
  ) {
    return this.notificationService.markAsRead({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      notificationId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('my/notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Request() req: TenantAwareRequest) {
    return this.notificationService.markAllAsRead({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
    });
  }
}
