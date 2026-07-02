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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { OrganizationService } from './organization.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/designation.dto';

@ApiTags('organization')
@ApiBearerAuth()
@Controller()
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ─── Departments ───────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('departments')
  @ApiOperation({ summary: 'List all departments' })
  getDepartments(@Request() req: TenantAwareRequest) {
    return this.orgService.getDepartments(req.tenant?.id ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('departments/:id')
  @ApiOperation({ summary: 'Get department by ID' })
  getDepartment(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.orgService.getDepartment(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('departments')
  @ApiOperation({ summary: 'Create a department' })
  @ApiBody({ type: CreateDepartmentDto })
  createDepartment(@Request() req: TenantAwareRequest, @Body() dto: CreateDepartmentDto) {
    return this.orgService.createDepartment(req.tenant?.id ?? null, dto, req.user?.userId ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update a department' })
  @ApiBody({ type: UpdateDepartmentDto })
  updateDepartment(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.orgService.updateDepartment(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('departments/:id')
  @ApiOperation({ summary: 'Delete a department' })
  deleteDepartment(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.orgService.deleteDepartment(req.tenant?.id ?? null, id);
  }

  // ─── Designations ─────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('designations')
  @ApiOperation({ summary: 'List all designations' })
  getDesignations(@Request() req: TenantAwareRequest) {
    return this.orgService.getDesignations(req.tenant?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('designations')
  @ApiOperation({ summary: 'Create a designation' })
  @ApiBody({ type: CreateDesignationDto })
  createDesignation(@Request() req: TenantAwareRequest, @Body() dto: CreateDesignationDto) {
    return this.orgService.createDesignation(req.tenant?.id ?? null, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('designations/:id')
  @ApiOperation({ summary: 'Update a designation' })
  @ApiBody({ type: UpdateDesignationDto })
  updateDesignation(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: UpdateDesignationDto) {
    return this.orgService.updateDesignation(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('designations/:id')
  @ApiOperation({ summary: 'Delete a designation' })
  deleteDesignation(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.orgService.deleteDesignation(req.tenant?.id ?? null, id);
  }
}
