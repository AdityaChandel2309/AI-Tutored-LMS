import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { CourseService } from './course.service';
import { CourseWorkflowService } from './course-workflow.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('courses')
@ApiBearerAuth()
@Controller()
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly workflowService: CourseWorkflowService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('courses')
  @ApiOperation({
    summary: 'List courses in the resolved tenant',
  })
  getCourses(
    @Request() req: TenantAwareRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.courseService.getCourses(req.tenant?.id ?? null, {
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      status,
      userId: req.user?.userId ?? undefined,
      roles: req.user?.roles ?? [],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:id')
  @ApiOperation({
    summary: 'Get a single tenant-scoped course',
  })
  getCourse(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.courseService.getCourseVisible(req.tenant?.id ?? null, id, {
      authUserId: req.user?.userId,
      roles: req.user?.roles ?? [],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  @Post('courses')
  @ApiOperation({
    summary: 'Create a course in the resolved tenant',
  })
  @ApiBody({ type: CreateCourseDto })
  createCourse(
    @Request() req: TenantAwareRequest,
    @Body() body: CreateCourseDto,
  ) {
    return this.courseService.createCourse({
      tenantId: req.tenant?.id ?? null,
      authUserId: req.user?.userId ?? '',
      body,
      roles: req.user?.roles ?? [],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('courses/:id')
  @ApiOperation({
    summary: 'Update a tenant-scoped course',
  })
  @ApiBody({ type: UpdateCourseDto })
  updateCourse(
    @Request() req: TenantAwareRequest,
    @Param('id') id: string,
    @Body() body: UpdateCourseDto,
  ) {
    return this.courseService.updateCourse({
      tenantId: req.tenant?.id ?? null,
      courseId: id,
      body,
      authUserId: req.user?.userId ?? '',
      roles: req.user?.roles ?? [],
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('courses/:id')
  @ApiOperation({
    summary: 'Delete a tenant-scoped course',
  })
  deleteCourse(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.courseService.deleteCourse(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('courses/:id/enroll')
  @ApiOperation({
    summary: 'Enroll the current user in a tenant-scoped course',
  })
  enrollInCourse(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.courseService.enrollInCourse({
      tenantId: req.tenant?.id ?? null,
      authUserId: req.user?.userId ?? '',
      courseId: id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-courses')
  @ApiOperation({
    summary: 'List the current user enrollments in the resolved tenant',
  })
  getMyCourses(@Request() req: TenantAwareRequest) {
    return this.courseService.getMyCourses({
      tenantId: req.tenant?.id ?? null,
      authUserId: req.user?.userId ?? '',
    });
  }

  // ─── Course Publish Workflow ────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('courses/:id/submit-review')
  @ApiOperation({
    summary: 'Submit a draft course for review',
  })
  submitForReview(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.workflowService.submitForReview(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('courses/:id/publish')
  @ApiOperation({
    summary: 'Publish a course that is in review',
  })
  publishCourse(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.workflowService.publish(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('courses/:id/archive')
  @ApiOperation({
    summary: 'Archive a published course',
  })
  archiveCourse(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.workflowService.archive(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('courses/:id/unpublish')
  @ApiOperation({
    summary: 'Unpublish a course (review→draft or archived→draft)',
  })
  unpublishCourse(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.workflowService.unpublish(req.tenant?.id ?? null, id);
  }
}
