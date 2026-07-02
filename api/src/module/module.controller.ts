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
import { ModuleService } from './module.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@ApiTags('modules')
@ApiBearerAuth()
@Controller()
export class ModuleController {
  constructor(private readonly moduleService: ModuleService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('courses/:id/modules')
  @ApiOperation({
    summary: 'Create a module inside a tenant-scoped course',
  })
  @ApiBody({ type: CreateModuleDto })
  createModule(
    @Request() req: TenantAwareRequest,
    @Param('id') courseId: string,
    @Body() body: CreateModuleDto,
  ) {
    return this.moduleService.createModule({
      tenantId: req.tenant?.id ?? null,
      courseId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('modules/:id')
  @ApiOperation({
    summary: 'Update a tenant-scoped module',
  })
  @ApiBody({ type: UpdateModuleDto })
  updateModule(
    @Request() req: TenantAwareRequest,
    @Param('id') moduleId: string,
    @Body() body: UpdateModuleDto,
  ) {
    return this.moduleService.updateModule({
      tenantId: req.tenant?.id ?? null,
      moduleId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('modules/:id')
  @ApiOperation({
    summary: 'Delete a tenant-scoped module',
  })
  deleteModule(
    @Request() req: TenantAwareRequest,
    @Param('id') moduleId: string,
  ) {
    return this.moduleService.deleteModule(req.tenant?.id ?? null, moduleId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('courses/:id/modules/reorder')
  @ApiOperation({
    summary: 'Reorder modules within a course',
  })
  reorderModules(
    @Request() req: TenantAwareRequest,
    @Param('id') courseId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.moduleService.reorderModules({
      tenantId: req.tenant?.id ?? null,
      courseId,
      orderedIds: body.orderedIds,
    });
  }
}
