import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { LessonResourceService } from './lesson-resource.service';

interface UploadUrlDto {
  label?: string;
  fileName: string;
  mimeType?: string;
}

interface ConfirmDto {
  resourceId: string;
  objectKey: string;
  label?: string;
  fileName: string;
  mimeType?: string;
}

@Controller()
export class LessonResourceController {
  constructor(private readonly svc: LessonResourceService) {}

  @Post('lessons/:id/resources/upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  requestUploadUrl(
    @Param('id') lessonId: string,
    @Body() body: UploadUrlDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.svc.requestUploadUrl({
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      lessonId,
      label: body.label ?? body.fileName,
      fileName: body.fileName,
      mimeType: body.mimeType ?? 'application/octet-stream',
    });
  }

  @Post('lessons/:id/resources/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  confirm(
    @Param('id') lessonId: string,
    @Body() body: ConfirmDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.svc.confirmUpload({
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      lessonId,
      resourceId: body.resourceId,
      objectKey: body.objectKey,
      label: body.label ?? body.fileName,
      fileName: body.fileName,
      mimeType: body.mimeType ?? 'application/octet-stream',
    });
  }

  @Get('lessons/:id/resources')
  @UseGuards(JwtAuthGuard)
  list(
    @Param('id') lessonId: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.svc.listForLesson({
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      lessonId,
    });
  }

  @Get('resources/:id/download')
  @UseGuards(JwtAuthGuard)
  download(
    @Param('id') resourceId: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.svc.getDownloadUrl({
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      resourceId,
    });
  }

  @Delete('resources/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  remove(
    @Param('id') resourceId: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.svc.deleteResource(req.tenant?.id ?? '', resourceId);
  }
}