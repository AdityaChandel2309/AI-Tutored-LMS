import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(tenantId: string | null) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });
  }

  async createCategory(tenantId: string | null, body: CreateCategoryDto) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const slug = body.slug.trim();
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        tenantId,
        slug,
      },
    });

    if (existingCategory) {
      throw new ConflictException(
        'Category slug already exists in current tenant',
      );
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        name: body.name.trim(),
        slug,
      },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });
  }

  async updateCategory(input: {
    tenantId: string | null;
    categoryId: string;
    body: UpdateCategoryDto;
  }) {
    const { tenantId, categoryId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found in current tenant');
    }

    const nextSlug = body.slug?.trim();
    if (nextSlug && nextSlug !== category.slug) {
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          tenantId,
          slug: nextSlug,
          NOT: { id: categoryId },
        },
      });

      if (existingCategory) {
        throw new ConflictException(
          'Category slug already exists in current tenant',
        );
      }
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: body.name?.trim(),
        slug: nextSlug,
      },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });
  }

  async deleteCategory(tenantId: string | null, categoryId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found in current tenant');
    }

    if (category._count.courses > 0) {
      throw new ConflictException('Category still has courses assigned');
    }

    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    return {
      id: categoryId,
      deleted: true,
    };
  }
}
