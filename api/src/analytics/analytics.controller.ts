import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── Learner Activity Timeline ─────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Get('analytics/dashboard-summary')
  @ApiOperation({ summary: 'Aggregated dashboard summary (single optimized query)' })
  getDashboardSummary(@Request() req: TenantAwareRequest) {
    return this.analyticsService.getDashboardSummary(req.tenant?.id ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/activity')
  @ApiOperation({
    summary: 'Get my activity timeline (paginated, newest first)',
  })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  getMyActivity(
    @Request() req: TenantAwareRequest,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('type') type?: string,
  ) {
    return this.analyticsService.getActivityTimeline({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      type: type || undefined,
    });
  }

  // ─── Reporting Endpoints (admin/instructor) ──

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Get('analytics/reports/completions')
  @ApiOperation({ summary: 'Course completion counts' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getCompletionReport(
    @Request() req: TenantAwareRequest,
    @Query('courseId') courseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getCompletionCounts({
      tenantId: req.tenant?.id ?? null,
      courseId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Get('analytics/reports/pass-rates')
  @ApiOperation({ summary: 'Assessment pass rates' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getPassRateReport(
    @Request() req: TenantAwareRequest,
    @Query('courseId') courseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getPassRates({
      tenantId: req.tenant?.id ?? null,
      courseId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Get('analytics/reports/enrollments')
  @ApiOperation({ summary: 'Enrollment counts' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getEnrollmentReport(
    @Request() req: TenantAwareRequest,
    @Query('courseId') courseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getEnrollmentCounts({
      tenantId: req.tenant?.id ?? null,
      courseId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Get('analytics/reports/certificates')
  @ApiOperation({ summary: 'Certificate issuance counts' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getCertificateReport(
    @Request() req: TenantAwareRequest,
    @Query('courseId') courseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getCertificateCounts({
      tenantId: req.tenant?.id ?? null,
      courseId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
