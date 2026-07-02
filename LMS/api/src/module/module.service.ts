import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  constructor(private readonly prisma: PrismaService) {}

  async createModule(input: {
    tenantId: string | null;
    courseId: string;
    body: CreateModuleDto;
  }) {
    const { tenantId, courseId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        tenantId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    let order = body.order;
    if (order === undefined || order === null) {
      const lastModule = await this.prisma.courseModule.findFirst({
        where: { courseId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (lastModule?.order ?? 0) + 1;
    }

    const existingOrder = await this.prisma.courseModule.findFirst({
      where: {
        courseId,
        order,
      },
    });

    if (existingOrder) {
      throw new ConflictException(
        `Module order ${order} already exists in this course`,
      );
    }

    return this.prisma.courseModule.create({
      data: {
        courseId,
        title: body.title.trim(),
        order,
      },
      include: {
        _count: {
          select: {
            lessons: true,
          },
        },
      },
    });
  }

  async updateModule(input: {
    tenantId: string | null;
    moduleId: string;
    body: UpdateModuleDto;
  }) {
    const { tenantId, moduleId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const mod = await this.prisma.courseModule.findFirst({
      where: { id: moduleId },
      include: {
        course: { select: { tenantId: true } },
      },
    });

    if (!mod || mod.course.tenantId !== tenantId) {
      throw new NotFoundException('Module not found in current tenant');
    }

    if (body.order !== undefined && body.order !== mod.order) {
      const existingOrder = await this.prisma.courseModule.findFirst({
        where: {
          courseId: mod.courseId,
          order: body.order,
          NOT: { id: moduleId },
        },
      });

      if (existingOrder) {
        throw new ConflictException(
          `Module order ${body.order} already exists in this course`,
        );
      }
    }

    return this.prisma.courseModule.update({
      where: { id: moduleId },
      data: {
        title: body.title?.trim(),
        order: body.order,
      },
      include: {
        _count: {
          select: {
            lessons: true,
          },
        },
      },
    });
  }

  async deleteModule(tenantId: string | null, moduleId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const mod = await this.prisma.courseModule.findFirst({
      where: { id: moduleId },
      include: {
        course: { select: { tenantId: true } },
        _count: {
          select: {
            lessons: true,
          },
        },
      },
    });

    if (!mod || mod.course.tenantId !== tenantId) {
      throw new NotFoundException('Module not found in current tenant');
    }

    if (mod._count.lessons > 0) {
      throw new ConflictException('Module still has lessons assigned');
    }

    await this.prisma.courseModule.delete({
      where: { id: moduleId },
    });

    return {
      id: moduleId,
      deleted: true,
    };
  }

  async reorderModules(input: {
    tenantId: string | null;
    courseId: string;
    orderedIds: string[];
  }) {
    const { tenantId, courseId, orderedIds } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    // Two-phase reorder to avoid @@unique([courseId, order]) violations:
    // Phase 1 — move all modules to negative temporary orders
    // Phase 2 — assign final 1-based orders
    await this.prisma.$transaction([
      ...orderedIds.map((id, index) =>
        this.prisma.courseModule.updateMany({
          where: { id, courseId },
          data: { order: -(index + 1) },
        }),
      ),
      ...orderedIds.map((id, index) =>
        this.prisma.courseModule.updateMany({
          where: { id, courseId },
          data: { order: index + 1 },
        }),
      ),
    ]);

    return this.prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: { _count: { select: { lessons: true } } },
    });
  }
}
