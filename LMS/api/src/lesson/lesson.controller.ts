import {
  Body,
  Controller,
  Delete,
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
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller()
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('modules/:id/lessons')
  @ApiOperation({
    summary: 'Create a lesson inside a tenant-scoped module',
  })
  @ApiBody({ type: CreateLessonDto })
  createLesson(
    @Request() req: TenantAwareRequest,
    @Param('id') moduleId: string,
    @Body() body: CreateLessonDto,
  ) {
    return this.lessonService.createLesson({
      tenantId: req.tenant?.id ?? null,
      moduleId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('lessons/:id')
  @ApiOperation({
    summary: 'Update a tenant-scoped lesson',
  })
  @ApiBody({ type: UpdateLessonDto })
  updateLesson(
    @Request() req: TenantAwareRequest,
    @Param('id') lessonId: string,
    @Body() body: UpdateLessonDto,
  ) {
    return this.lessonService.updateLesson({
      tenantId: req.tenant?.id ?? null,
      lessonId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('lessons/:id')
  @ApiOperation({
    summary: 'Delete a tenant-scoped lesson',
  })
  deleteLesson(
    @Request() req: TenantAwareRequest,
    @Param('id') lessonId: string,
  ) {
    return this.lessonService.deleteLesson(req.tenant?.id ?? null, lessonId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('modules/:id/lessons/reorder')
  @ApiOperation({
    summary: 'Reorder lessons within a module',
  })
  reorderLessons(
    @Request() req: TenantAwareRequest,
    @Param('id') moduleId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.lessonService.reorderLessons({
      tenantId: req.tenant?.id ?? null,
      moduleId,
      orderedIds: body.orderedIds,
    });
  }
}
