import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  @ApiOperation({
    summary: 'List users in the resolved tenant',
  })
  getUsers(@Request() req: TenantAwareRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.userService.getUsers(req.tenant?.id ?? null, { page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @ApiOperation({
    summary: 'Create a user in Keycloak and the LMS tenant',
  })
  @ApiBody({ type: CreateUserDto })
  createUser(@Request() req: TenantAwareRequest, @Body() body: CreateUserDto) {
    return this.userService.createUser(req.tenant?.id ?? null, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  @ApiOperation({
    summary: 'Replace the target user role set',
  })
  @ApiBody({ type: UpdateUserRolesDto })
  updateUserRole(
    @Request() req: TenantAwareRequest,
    @Param('id') id: string,
    @Body() body: UpdateUserRolesDto,
  ) {
    return this.userService.updateUserRole(
      req.tenant?.id ?? null,
      id,
      body.roles,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a tenant-scoped user',
  })
  deactivateUser(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.userService.deactivateUser(req.tenant?.id ?? null, id);
  }
}
