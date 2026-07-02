import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto, UpdateProjectStatusDto, CreateMilestoneDto, UpdateMilestoneDto, AddMemberDto } from './dto/project.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @UseGuards(JwtAuthGuard)
  @Get('projects')
  @ApiOperation({ summary: 'List projects' })
  getProjects(@Request() req: TenantAwareRequest, @Query('status') status?: string, @Query('departmentId') departmentId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.projectService.getProjects(req.tenant?.id ?? null, { status, departmentId, page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:id')
  @ApiOperation({ summary: 'Get project detail' })
  getProject(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.projectService.getProject(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('projects')
  @ApiOperation({ summary: 'Create project' })
  @ApiBody({ type: CreateProjectDto })
  createProject(@Request() req: TenantAwareRequest, @Body() dto: CreateProjectDto) {
    return this.projectService.createProject(req.tenant?.id ?? null, dto, req.user?.userId ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('projects/:id')
  @ApiOperation({ summary: 'Update project' })
  @ApiBody({ type: UpdateProjectDto })
  updateProject(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectService.updateProject(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('projects/:id/status')
  @ApiOperation({ summary: 'Update project status' })
  @ApiBody({ type: UpdateProjectStatusDto })
  updateStatus(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.projectService.updateStatus(req.tenant?.id ?? null, id, dto, req.user?.userId ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('projects/:id')
  @ApiOperation({ summary: 'Delete project' })
  deleteProject(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.projectService.deleteProject(req.tenant?.id ?? null, id);
  }

  // ─── Milestones ────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('projects/:id/milestones')
  @ApiOperation({ summary: 'Add milestone' })
  @ApiBody({ type: CreateMilestoneDto })
  createMilestone(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.projectService.createMilestone(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('projects/:id/milestones/:milestoneId')
  @ApiOperation({ summary: 'Update milestone' })
  @ApiBody({ type: UpdateMilestoneDto })
  updateMilestone(@Request() req: TenantAwareRequest, @Param('id') id: string, @Param('milestoneId') milestoneId: string, @Body() dto: UpdateMilestoneDto) {
    return this.projectService.updateMilestone(req.tenant?.id ?? null, id, milestoneId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('projects/:id/milestones/:milestoneId')
  @ApiOperation({ summary: 'Delete milestone' })
  deleteMilestone(@Request() req: TenantAwareRequest, @Param('id') id: string, @Param('milestoneId') milestoneId: string) {
    return this.projectService.deleteMilestone(req.tenant?.id ?? null, id, milestoneId);
  }

  // ─── Members ───────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('projects/:id/members')
  @ApiOperation({ summary: 'Add project member' })
  @ApiBody({ type: AddMemberDto })
  addMember(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.projectService.addMember(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('projects/:id/members/:userId')
  @ApiOperation({ summary: 'Remove project member' })
  removeMember(@Request() req: TenantAwareRequest, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projectService.removeMember(req.tenant?.id ?? null, id, userId);
  }
}
