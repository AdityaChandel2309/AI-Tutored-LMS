import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  type PrismaMock = {
    category: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const prisma: PrismaMock = {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: CategoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CategoryService(prisma as unknown as PrismaService);
  });

  it('lists categories only within the resolved tenant', async () => {
    prisma.category.findMany.mockResolvedValue([{ id: 'category-1' }]);

    const result = await service.getCategories('tenant-1');

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });
    expect(result).toHaveLength(1);
  });

  it('rejects category creation when tenant is missing', async () => {
    await expect(
      service.createCategory(null, {
        name: 'Engineering',
        slug: 'engineering',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a tenant-scoped category', async () => {
    prisma.category.findFirst.mockResolvedValueOnce(null);
    prisma.category.create.mockResolvedValue({
      id: 'category-1',
      slug: 'engineering',
    });

    const result = await service.createCategory('tenant-1', {
      name: ' Engineering ',
      slug: 'engineering',
    });

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        name: 'Engineering',
        slug: 'engineering',
      },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });
    expect(result.id).toBe('category-1');
  });

  it('rejects duplicate category slugs within the same tenant', async () => {
    prisma.category.findFirst.mockResolvedValueOnce({
      id: 'category-existing',
    });

    await expect(
      service.createCategory('tenant-1', {
        name: 'Engineering',
        slug: 'engineering',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a tenant-scoped category', async () => {
    prisma.category.findFirst
      .mockResolvedValueOnce({
        id: 'category-1',
        tenantId: 'tenant-1',
        slug: 'engineering',
      })
      .mockResolvedValueOnce(null);
    prisma.category.update.mockResolvedValue({
      id: 'category-1',
      slug: 'platform-engineering',
    });

    const result = await service.updateCategory({
      tenantId: 'tenant-1',
      categoryId: 'category-1',
      body: {
        name: ' Platform Engineering ',
        slug: 'platform-engineering',
      },
    });

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'category-1' },
      data: {
        name: 'Platform Engineering',
        slug: 'platform-engineering',
      },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });
    expect(result.slug).toBe('platform-engineering');
  });

  it('blocks category deletion while courses still exist', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-1',
      tenantId: 'tenant-1',
      _count: {
        courses: 1,
      },
    });

    await expect(
      service.deleteCategory('tenant-1', 'category-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes an empty tenant-scoped category', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-1',
      tenantId: 'tenant-1',
      _count: {
        courses: 0,
      },
    });

    const result = await service.deleteCategory('tenant-1', 'category-1');

    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: { id: 'category-1' },
    });
    expect(result).toEqual({
      id: 'category-1',
      deleted: true,
    });
  });

  it('rejects category updates outside the current tenant', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.updateCategory({
        tenantId: 'tenant-1',
        categoryId: 'category-x',
        body: {
          name: 'Updated',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
