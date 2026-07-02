import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  AddMemberDto,
} from './dto/project.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  planning: ['active', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async getProjects(
    tenantId: string | null,
    filters: {
      status?: string;
      departmentId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const where: Record<string, unknown> = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.departmentId) where.departmentId = filters.departmentId;

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          department: { select: { id: true, name: true } },
          _count: { select: { milestones: true, members: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getProject(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: { select: { id: true, name: true } },
        milestones: { orderBy: { order: 'asc' } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async createProject(
    tenantId: string | null,
    dto: CreateProjectDto,
    actorId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: actorId, tenantId },
    });
    if (!user) throw new ForbiddenException('User not found');

    const project = await this.prisma.project.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        departmentId: dto.departmentId,
        ownerId: user.id,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        targetEndDate: dto.targetEndDate ? new Date(dto.targetEndDate) : null,
      },
    });

    // Add owner as member
    await this.prisma.projectMember.create({
      data: { projectId: project.id, userId: user.id, role: 'owner' },
    });

    this.eventBus.emit({
      type: 'project.created',
      tenantId,
      timestamp: new Date(),
      actorId: user.id,
      entityId: project.id,
      entityType: 'project',
      payload: { projectId: project.id, title: project.title },
    });
    return project;
  }

  async updateProject(
    tenantId: string | null,
    id: string,
    dto: UpdateProjectDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        departmentId: dto.departmentId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        targetEndDate: dto.targetEndDate
          ? new Date(dto.targetEndDate)
          : undefined,
      },
    });
  }

  async updateStatus(
    tenantId: string | null,
    id: string,
    dto: UpdateProjectStatusDto,
    actorId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const allowed = VALID_TRANSITIONS[project.status] ?? [];
    if (!allowed.includes(dto.status))
      throw new BadRequestException(
        `Cannot transition from ${project.status} to ${dto.status}`,
      );

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status: dto.status,
        actualEndDate: dto.status === 'completed' ? new Date() : undefined,
      },
    });

    this.eventBus.emit({
      type: 'project.status_changed',
      tenantId,
      timestamp: new Date(),
      actorId,
      entityId: id,
      entityType: 'project',
      payload: { projectId: id, from: project.status, to: dto.status },
    });
    return updated;
  }

  async deleteProject(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.project.delete({ where: { id } });
  }

  // ─── Milestones ────────────────────────────

  async createMilestone(
    tenantId: string | null,
    projectId: string,
    dto: CreateMilestoneDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.milestone.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order: dto.order,
      },
    });
  }

  async updateMilestone(
    tenantId: string | null,
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const data: Record<string, unknown> = {};
    if (dto.title) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status) data.status = dto.status;
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.status === 'completed') data.completedAt = new Date();

    return this.prisma.milestone.update({ where: { id: milestoneId }, data });
  }

  async deleteMilestone(
    tenantId: string | null,
    projectId: string,
    milestoneId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.milestone.delete({ where: { id: milestoneId } });
  }

  // ─── Members ───────────────────────────────

  async addMember(
    tenantId: string | null,
    projectId: string,
    dto: AddMemberDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing)
      throw new ConflictException('User is already a member of this project');

    return this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role ?? 'member' },
    });
  }

  async removeMember(
    tenantId: string | null,
    projectId: string,
    userId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!existing) throw new NotFoundException('Project member not found');
    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
