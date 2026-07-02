import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import {
  CreateEmployeeProfileDto,
  UpdateEmployeeProfileDto,
  EmployeeFilterDto,
} from './dto/employee.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async getEmployees(tenantId: string | null, filters: EmployeeFilterDto) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.designationId) where.designationId = filters.designationId;
    if (filters.search) {
      where.OR = [
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
        {
          user: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          user: { lastName: { contains: filters.search, mode: 'insensitive' } },
        },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, name: true, level: true } },
        },
        orderBy: { employeeCode: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getEmployee(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            roles: true,
          },
        },
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, name: true, level: true } },
        reportingManager: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!profile) throw new NotFoundException('Employee profile not found');
    return profile;
  }

  async getReportees(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee profile not found');

    return this.prisma.employeeProfile.findMany({
      where: { tenantId, reportingManagerId: profile.userId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        designation: { select: { id: true, name: true } },
      },
    });
  }

  async createEmployee(
    tenantId: string | null,
    dto: CreateEmployeeProfileDto,
    actorId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const existing = await this.prisma.employeeProfile.findUnique({
      where: {
        tenantId_employeeCode: { tenantId, employeeCode: dto.employeeCode },
      },
    });
    if (existing) throw new ConflictException('Employee code already exists');

    const profile = await this.prisma.employeeProfile.create({
      data: {
        userId: dto.userId,
        tenantId,
        employeeCode: dto.employeeCode,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        reportingManagerId: dto.reportingManagerId,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
        location: dto.location,
        phone: dto.phone,
      },
    });

    this.eventBus.emit({
      type: 'employee.created',
      tenantId,
      timestamp: new Date(),
      actorId,
      entityId: profile.id,
      entityType: 'employee',
      payload: { employeeId: profile.id, employeeCode: profile.employeeCode },
    });

    return profile;
  }

  async updateEmployee(
    tenantId: string | null,
    id: string,
    dto: UpdateEmployeeProfileDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id, tenantId },
    });
    if (!profile) throw new NotFoundException('Employee profile not found');

    return this.prisma.employeeProfile.update({
      where: { id },
      data: {
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        reportingManagerId: dto.reportingManagerId,
        dateOfJoining: dto.dateOfJoining
          ? new Date(dto.dateOfJoining)
          : undefined,
        location: dto.location,
        phone: dto.phone,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: dto.metadata as any,
      },
    });
  }

  async importCsv(
    tenantId: string | null,
    csvContent: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _actorId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const lines = csvContent.trim().split('\n');
    if (lines.length < 2)
      return {
        imported: 0,
        errors: ['CSV must have a header row and at least one data row'],
      };

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const requiredHeaders = ['employee_code', 'user_email'];
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length)
      return {
        imported: 0,
        errors: [`Missing required columns: ${missing.join(', ')}`],
      };

    const results = { imported: 0, errors: [] as string[] };

    await this.prisma.$transaction(async (tx) => {
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] ?? '';
        });

        if (!row.employee_code || !row.user_email) {
          results.errors.push(
            `Row ${i + 1}: Missing required fields (employee_code, user_email)`,
          );
          continue;
        }

        try {
          const user = await tx.user.findFirst({
            where: { email: row.user_email, tenantId },
          });
          if (!user) {
            results.errors.push(
              `Row ${i + 1}: User not found for email ${row.user_email}`,
            );
            continue;
          }

          let departmentId: string | undefined;
          if (row.department_code) {
            const dept = await tx.department.findUnique({
              where: { tenantId_code: { tenantId, code: row.department_code } },
            });
            if (dept) departmentId = dept.id;
          }

          let designationId: string | undefined;
          if (row.designation) {
            const des = await tx.designation.findUnique({
              where: { tenantId_name: { tenantId, name: row.designation } },
            });
            if (des) designationId = des.id;
          }

          await tx.employeeProfile.upsert({
            where: {
              tenantId_employeeCode: {
                tenantId,
                employeeCode: row.employee_code,
              },
            },
            create: {
              userId: user.id,
              tenantId,
              employeeCode: row.employee_code,
              departmentId,
              designationId,
              location: row.location || null,
              phone: row.phone || null,
              dateOfJoining: row.date_of_joining
                ? new Date(row.date_of_joining)
                : null,
            },
            update: {
              departmentId,
              designationId,
              location: row.location !== '' ? row.location : null,
              phone: row.phone !== '' ? row.phone : null,
            },
          });

          results.imported++;
        } catch (err) {
          results.errors.push(`Row ${i + 1}: ${(err as Error).message}`);
        }
      }
    });

    return results;
  }
}
