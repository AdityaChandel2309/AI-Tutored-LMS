import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { VideoService } from './video.service';
import { RequestUploadUrlDto, ConfirmUploadDto } from './dto/video.dto';

@Controller()
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /**
   * POST /courses/:courseId/videos/upload-url
   * Generate a presigned upload URL. Admin + Instructor only.
   */
  @Post('courses/:courseId/videos/upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  async requestUploadUrl(
    @Param('courseId') courseId: string,
    @Body() dto: RequestUploadUrlDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.videoService.requestUploadUrl({
      courseId,
      tenantId: req.tenant?.id ?? '',
      userId: req.user!.userId,
      title: dto.title,
      mimeType: dto.mimeType ?? 'video/mp4',
      fileName: dto.fileName,
    });
  }

  /**
   * PATCH /videos/:id/confirm
   * Confirm upload completed. Admin + Instructor only.
   */
  @Patch('videos/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  async confirmUpload(
    @Param('id') id: string,
    @Body() dto: ConfirmUploadDto,
    @Request() req: TenantAwareRequest,
  ) {
    return this.videoService.confirmUpload({
      videoId: id,
      tenantId: req.tenant?.id ?? '',
      lessonId: dto.lessonId,
    });
  }

  /**
   * GET /videos/:id
   * Get video metadata. Authenticated users.
   */
  @Get('videos/:id')
  @UseGuards(JwtAuthGuard)
  async getVideo(@Param('id') id: string, @Request() req: TenantAwareRequest) {
    return this.videoService.getVideo(id, req.tenant?.id ?? '');
  }

  /**
   * GET /videos/:id/stream
   * Get presigned playback URL. Must be enrolled or be the uploader.
   */
  @Get('videos/:id/stream')
  @UseGuards(JwtAuthGuard)
  async getStreamUrl(
    @Param('id') id: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.videoService.getStreamUrl({
      videoId: id,
      userId: req.user!.userId,
      tenantId: req.tenant?.id ?? '',
      roles: req.user?.roles ?? [],
    });
  }

  /**
   * DELETE /videos/:id
   * Soft-delete a video. Admin + Instructor only.
   */
  @Delete('videos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  async deleteVideo(
    @Param('id') id: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.videoService.deleteVideo(id, req.tenant?.id ?? '');
  }

  /**
   * GET /videos/:id/thumbnail
   * Get presigned URL for video thumbnail. Authenticated users.
   */
  @Get('videos/:id/thumbnail')
  @UseGuards(JwtAuthGuard)
  async getThumbnailUrl(
    @Param('id') id: string,
    @Request() req: TenantAwareRequest,
  ) {
    return this.videoService.getThumbnailUrl(id, req.tenant?.id ?? '');
  }
}
