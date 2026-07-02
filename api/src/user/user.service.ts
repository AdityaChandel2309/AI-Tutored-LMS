import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async getUsers(tenantId: string | null, opts?: { page?: number; limit?: number }) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);

    return { items, total, page, limit };
  }

  async createUser(tenantId: string | null, input: CreateUserDto) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists in LMS');
    }

    const keycloakUser = await this.authService.createKeycloakUser(input);

    return this.prisma.user.create({
      data: {
        keycloakId: keycloakUser.keycloakUserId,
        email: input.email,
        roles: keycloakUser.roles,
        tenantId,
      },
    });
  }

  async updateUserRole(
    tenantId: string | null,
    userId: string,
    roles: string[],
  ) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in current tenant');
    }

    const syncedRoles = await this.authService.updateUserRoles(
      user.keycloakId,
      roles,
    );

    return this.prisma.user.update({
      where: { id: userId },
      data: { roles: syncedRoles },
    });
  }

  async deactivateUser(tenantId: string | null, userId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in current tenant');
    }

    await this.authService.deactivateUser(user.keycloakId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}
