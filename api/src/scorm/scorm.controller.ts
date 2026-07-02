import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { ScormService } from './scorm.service';
import { ConfirmScormUploadDto, RequestScormUploadDto, SaveRuntimeDataDto } from './dto/scorm.dto';

@ApiTags('scorm')
@ApiBearerAuth()
@Controller()
export class ScormController {
  constructor(private readonly scormService: ScormService) {}

  /**
   * POST /courses/:courseId/scorm/upload-url
   * Generate a presigned upload URL for a SCORM package.
   */
  @Post('courses/:courseId/scorm/upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  async requestUploadUrl(
    @Param('courseId') courseId: string,
    @Body() dto: RequestScormUploadDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.scormService.requestUploadUrl({
      courseId,
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      title: dto.title,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
    });
  }

  /**
   * PATCH /scorm/:id/confirm
   * Confirm upload, parse manifest, and persist metadata.
   */
  @Patch('scorm/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  async confirmUpload(
    @Param('id') id: string,
    @Body() dto: ConfirmScormUploadDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.scormService.confirmUpload({
      packageId: id,
      tenantId: req.tenant?.id ?? '',
      lessonId: dto.lessonId,
    });
  }

  /**
   * GET /scorm/:id
   * Get SCORM package metadata.
   */
  @Get('scorm/:id')
  @UseGuards(JwtAuthGuard)
  async getPackage(
    @Param('id') id: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.scormService.getPackage({
      packageId: id,
      tenantId: req.tenant?.id ?? '',
    });
  }

  /**
   * GET /scorm/:id/launch
   * Get launch metadata for a package.
   */
  @Get('scorm/:id/launch')
  @UseGuards(JwtAuthGuard)
  async getLaunchInfo(
    @Param('id') id: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.scormService.getLaunchInfo({
      packageId: id,
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
    });
  }

  /**
   * GET /scorm/:id/files/:path(*)
   * Stream a file from the SCORM package.
   */
  @Get('scorm/:id/files/*path')
  @UseGuards(JwtAuthGuard)
  async getScormFile(
    @Param('id') id: string,
    @Param('path') path: string | string[],
    @Request() req: TenantAwareRequest,
    @Response({ passthrough: true })
    res: ExpressResponse,
  ) {
    const resolvedPath = Array.isArray(path) ? path.join('/') : path;
    const file = await this.scormService.getFile({
      packageId: id,
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      path: resolvedPath,
    });

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.data.length);

    return new StreamableFile(file.data);
  }

  /**
   * GET /scorm/:id/runtime-data
   * Get or initialize SCORM runtime data for the current user.
   */
  @Get('scorm/:id/runtime-data')
  @UseGuards(JwtAuthGuard)
  async getRuntimeData(
    @Param('id') id: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.scormService.getRuntimeData({
      packageId: id,
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
    });
  }

  /**
   * PUT /scorm/:id/runtime-data
   * Save/commit SCORM runtime data.
   */
  @Put('scorm/:id/runtime-data')
  @UseGuards(JwtAuthGuard)
  async saveRuntimeData(
    @Param('id') id: string,
    @Body() dto: SaveRuntimeDataDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.scormService.saveRuntimeData({
      packageId: id,
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      data: dto,
    });
  }
}
