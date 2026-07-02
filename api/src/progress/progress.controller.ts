import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { ProgressService } from './progress.service';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { CompleteLessonDto } from './dto/complete-lesson.dto';

@ApiTags('progress')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @UseGuards(JwtAuthGuard)
  @Post('courses/:courseId/progress')
  @ApiOperation({
    summary: 'Create or update lesson progress for the current user',
  })
  @ApiBody({ type: UpdateProgressDto })
  upsertProgress(
    @Request() req: TenantAwareRequest,
    @Param('courseId') courseId: string,
    @Body() body: UpdateProgressDto,
  ) {
    return this.progressService.upsertProgress({
      tenantId: req.tenant?.id ?? null,
      authUserId: req.user?.userId ?? '',
      courseId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('courses/complete-lesson')
  @ApiOperation({
    summary:
      'Mark a lesson complete from an xAPI-style statement (auto-tracking)',
  })
  @ApiBody({ type: CompleteLessonDto })
  completeLesson(
    @Request() req: TenantAwareRequest,
    @Body() body: CompleteLessonDto,
  ) {
    return this.progressService.completeLesson({
      tenantId: req.tenant?.id ?? null,
      authUserId: req.user?.userId ?? '',
      courseId: body.courseId,
      lessonId: body.lessonId,
      status: body.status,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/progress')
  @ApiOperation({
    summary: 'Get per-lesson progress and summary for the current user',
  })
  getProgress(
    @Request() req: TenantAwareRequest,
    @Param('courseId') courseId: string,
  ) {
    return this.progressService.getProgress({
      tenantId: req.tenant?.id ?? null,
      authUserId: req.user?.userId ?? '',
      courseId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('progress/:id')
  @ApiOperation({
    summary: 'Update a specific progress record',
  })
  @ApiBody({ type: UpdateProgressDto })
  patchProgress(
    @Request() req: TenantAwareRequest,
    @Param('id') progressId: string,
    @Body() body: Partial<UpdateProgressDto>,
  ) {
    return this.progressService.patchProgress({
      tenantId: req.tenant?.id ?? null,
      progressId,
      body,
    });
  }
}
