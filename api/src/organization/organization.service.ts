import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/designation.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Departments ───────────────────────────

  async getDepartments(tenantId: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    return this.prisma.department.findMany({
      where: { tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDepartment(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { employees: true } },
      },
    });

    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async createDepartment(tenantId: string | null, dto: CreateDepartmentDto, actorId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const existing = await this.prisma.department.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) throw new ConflictException('Department code already exists');

    const dept = await this.prisma.department.create({
      data: { tenantId, name: dto.name, code: dto.code, parentId: dto.parentId, managerId: dto.managerId },
    });

    this.eventBus.emit({
      type: 'department.created',
      tenantId,
      timestamp: new Date(),
      actorId,
      entityId: dept.id,
      entityType: 'department',
      payload: { departmentId: dept.id, name: dept.name, code: dept.code },
    });

    return dept;
  }

  async updateDepartment(tenantId: string | null, id: string, dto: UpdateDepartmentDto) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Department not found');

    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async deleteDepartment(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { employees: true, children: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept._count.employees > 0) throw new ConflictException('Cannot delete department with employees');
    if (dept._count.children > 0) throw new ConflictException('Cannot delete department with sub-departments');

    return this.prisma.department.delete({ where: { id } });
  }

  // ─── Designations ─────────────────────────

  async getDesignations(tenantId: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    return this.prisma.designation.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: { level: 'asc' },
    });
  }

  async createDesignation(tenantId: string | null, dto: CreateDesignationDto) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    return this.prisma.designation.create({
      data: { tenantId, name: dto.name, level: dto.level },
    });
  }

  async updateDesignation(tenantId: string | null, id: string, dto: UpdateDesignationDto) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const des = await this.prisma.designation.findFirst({ where: { id, tenantId } });
    if (!des) throw new NotFoundException('Designation not found');

    return this.prisma.designation.update({ where: { id }, data: dto });
  }

  async deleteDesignation(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const des = await this.prisma.designation.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { employees: true } } },
    });
    if (!des) throw new NotFoundException('Designation not found');
    if (des._count.employees > 0) throw new ConflictException('Cannot delete designation with employees');

    return this.prisma.designation.delete({ where: { id } });
  }
}
