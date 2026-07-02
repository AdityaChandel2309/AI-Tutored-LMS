import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PrismaService } from './prisma/prisma.service';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { StorageService } from './storage/storage.service';
import type { TenantAwareRequest } from './tenant/tenant.middleware';
import { UpdateProfileDto } from './app/dto/update-profile.dto';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health-style root endpoint',
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resolve and return the current LMS user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current LMS user record for the authenticated principal.',
  })
  async getMe(@Request() req: TenantAwareRequest) {
    const authUser = req.user;
    const tenant = req.tenant;

    if (!authUser) {
      throw new ForbiddenException('Authenticated user context missing');
    }

    if (!tenant) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    let user = await this.prisma.user.findUnique({
      where: { keycloakId: authUser.userId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          keycloakId: authUser.userId,
          email: authUser.email,
          roles: authUser.roles,
          tenantId: tenant.id,
        },
      });

      return user;
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    if (user.tenantId !== tenant.id) {
      throw new ForbiddenException(
        'User does not belong to the resolved tenant',
      );
    }

    return this.prisma.user.update({
      where: { keycloakId: authUser.userId },
      data: {
        email: authUser.email,
        roles: authUser.roles,
      },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin-only probe route',
  })
  getAdmin() {
    return 'Admin only';
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update the current user profile',
  })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(
    @Request() req: TenantAwareRequest,
    @Body() body: UpdateProfileDto,
  ) {
    const user = await this.requireTenantUser(req);

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: body.firstName?.trim() || null,
        lastName: body.lastName?.trim() || null,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload an avatar for the current user',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadAvatar(
    @Request() req: TenantAwareRequest,
    @UploadedFile()
    file?: {
      originalname?: string;
      mimetype?: string;
      buffer: Buffer;
    },
  ) {
    const user = await this.requireTenantUser(req);

    if (!file) {
      throw new ForbiddenException('Avatar file is required');
    }

    const avatarUrl = await this.storageService.uploadAvatar({
      userId: user.id,
      fileName: file.originalname,
      contentType: file.mimetype,
      body: file.buffer,
    });

    return this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });
  }

  private async requireTenantUser(req: TenantAwareRequest) {
    const authUser = req.user;
    const tenant = req.tenant;

    if (!authUser) {
      throw new ForbiddenException('Authenticated user context missing');
    }

    if (!tenant) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const user = await this.prisma.user.findUnique({
      where: { keycloakId: authUser.userId },
    });

    if (!user || user.tenantId !== tenant.id) {
      throw new ForbiddenException(
        'User does not belong to the resolved tenant',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    return user;
  }
}
