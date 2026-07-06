import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Builds a compact, read-only snapshot of live platform data (projects,
 * employees, courses, organization) for the knowledge assistant.
 *
 * SECURITY: This snapshot exposes tenant-wide operational data and is intended
 * for ADMIN users only. The caller (KnowledgeAssistantService) must gate this
 * by role before injecting the result into the LLM prompt.
 *
 * The output is plain text, tenant-scoped, and intentionally bounded (counts +
 * a capped list of recent/notable rows) so it fits in the model context window
 * without leaking the entire database.
 */
@Injectable()
export class PlatformContextService {
  private readonly logger = new Logger(PlatformContextService.name);

  // Caps to keep the prompt bounded regardless of tenant size.
  private static readonly MAX_PROJECTS = 25;
  private static readonly MAX_EMPLOYEES = 25;
  private static readonly MAX_COURSES = 25;
  private static readonly MAX_DOCUMENTS = 30;
  private static readonly MAX_CATEGORIES = 20;
  private static readonly MAX_MILESTONES = 15;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a strictly self-scoped context block for a non-admin user.
   * Contains ONLY data about the requesting user: their profile, department,
   * designation, manager, their enrollments/progress, certificates, and their
   * own project ownerships/memberships. Never leaks other employees' PII or
   * org-wide operational data.
   */
  async buildUserContext(tenantId: string | null, userId: string): Promise<string> {
    if (!tenantId || !userId) return '';
    try {
      const [user, enrollments, certificates, ownedProjects, memberships] = await Promise.all([
        this.prisma.user.findFirst({
          where: { id: userId, tenantId },
          select: {
            firstName: true,
            lastName: true,
            email: true,
            roles: true,
            employeeProfile: {
              select: {
                employeeCode: true,
                dateOfJoining: true,
                location: true,
                department: { select: { name: true } },
                designation: { select: { name: true, level: true } },
                reportingManager: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        }),
        this.prisma.enrollment.findMany({
          where: { userId, course: { tenantId } },
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            progress: true,
            completedAt: true,
            createdAt: true,
            course: { select: { title: true, status: true } },
          },
        }),
        this.prisma.issuedCertificate.findMany({
          where: { tenantId, userId },
          orderBy: { issuedAt: 'desc' },
          take: 25,
          select: { certificateNumber: true, courseTitle: true, issuedAt: true },
        }).catch(() => [] as Array<{ certificateNumber: string; courseTitle: string; issuedAt: Date }>),
        this.prisma.project.findMany({
          where: { tenantId, ownerId: userId },
          orderBy: { updatedAt: 'desc' },
          take: 15,
          select: { title: true, status: true, startDate: true, targetEndDate: true, actualEndDate: true },
        }),
        this.prisma.projectMember.findMany({
          where: { userId, project: { tenantId } },
          orderBy: { joinedAt: 'desc' },
          take: 15,
          select: { role: true, project: { select: { title: true, status: true } } },
        }),
      ]);

      if (!user) return '';

      const fmtDate = (d: Date | null | undefined) =>
        d ? new Date(d).toISOString().slice(0, 10) : '—';
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
      const ep = user.employeeProfile;
      const mgr = ep?.reportingManager;
      const mgrName = mgr
        ? [mgr.firstName, mgr.lastName].filter(Boolean).join(' ') || mgr.email
        : '—';

      const lines: string[] = [];
      lines.push('## Your Profile');
      lines.push(`- Name: ${name}`);
      lines.push(`- Email: ${user.email}`);
      if (ep) {
        lines.push(`- Employee code: ${ep.employeeCode}`);
        lines.push(`- Department: ${ep.department?.name ?? '—'}`);
        lines.push(`- Designation: ${ep.designation?.name ?? '—'}${ep.designation?.level ? ` (level ${ep.designation.level})` : ''}`);
        lines.push(`- Reporting manager: ${mgrName}`);
        lines.push(`- Date of joining: ${fmtDate(ep.dateOfJoining)}`);
        if (ep.location) lines.push(`- Location: ${ep.location}`);
      }

      lines.push('');
      lines.push('## Your Learning');
      if (enrollments.length === 0) {
        lines.push('- No enrollments yet.');
      } else {
        const completed = enrollments.filter((e) => e.completedAt).length;
        lines.push(`- Enrollments: ${enrollments.length} shown, ${completed} completed`);
        for (const e of enrollments) {
          const state = e.completedAt
            ? `completed on ${fmtDate(e.completedAt)}`
            : `in progress (${Math.round(e.progress * 100)}%)`;
          lines.push(`  • "${e.course.title}" — ${state}`);
        }
      }
      if (certificates.length > 0) {
        lines.push(`- Certificates: ${certificates.length}`);
        for (const c of certificates) {
          lines.push(`  • "${c.courseTitle}" — issued ${fmtDate(c.issuedAt)} (# ${c.certificateNumber})`);
        }
      }

      lines.push('');
      lines.push('## Your Projects');
      if (ownedProjects.length === 0 && memberships.length === 0) {
        lines.push('- You are not on any projects.');
      } else {
        for (const p of ownedProjects) {
          lines.push(`  • Owner of "${p.title}" — status: ${p.status} | start: ${fmtDate(p.startDate)} | target: ${fmtDate(p.targetEndDate)}${p.actualEndDate ? ` | completed: ${fmtDate(p.actualEndDate)}` : ''}`);
        }
        for (const m of memberships) {
          lines.push(`  • ${m.role} on "${m.project.title}" — status: ${m.project.status}`);
        }
      }

      return lines.join('\n');
    } catch (err) {
      this.logger.warn(`Failed to build user context: ${(err as Error).message}`);
      return '';
    }
  }

  /**
   * Build the admin platform-data context block. Returns an empty string if no
   * tenant is resolved or if aggregation fails (the assistant then simply
   * answers from documents only).
   */
  async buildAdminContext(tenantId: string | null): Promise<string> {
    if (!tenantId) return '';

    try {
      const [
        projectStatusCounts,
        recentProjects,
        employeeTotal,
        employeesByDepartment,
        employeesByDesignation,
        courseStatusCounts,
        recentCourses,
        userTotal,
        activeUserTotal,
        enrollmentTotal,
        completedEnrollmentTotal,
        certificateTotal,
        departments,
        designations,
        recentEmployees,
        documentStatusCounts,
        recentDocuments,
        knowledgeCategories,
        recentMilestones,
        recentEnrollments,
        recentCertificates,
        tenant,
      ] = await Promise.all([
        this.prisma.project.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.project.findMany({
          where: { tenantId },
          select: {
            title: true,
            status: true,
            startDate: true,
            targetEndDate: true,
            actualEndDate: true,
            owner: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
            _count: { select: { milestones: true, members: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: PlatformContextService.MAX_PROJECTS,
        }),
        this.prisma.employeeProfile.count({ where: { tenantId } }),
        this.prisma.employeeProfile.groupBy({
          by: ['departmentId'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.employeeProfile.groupBy({
          by: ['designationId'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.course.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.course.findMany({
          where: { tenantId },
          select: { title: true, status: true, visibility: true },
          orderBy: { updatedAt: 'desc' },
          take: PlatformContextService.MAX_COURSES,
        }),
        this.prisma.user.count({ where: { tenantId } }),
        this.prisma.user.count({ where: { tenantId, isActive: true } }),
        this.prisma.enrollment.count({ where: { course: { tenantId } } }),
        this.prisma.enrollment.count({
          where: { course: { tenantId }, completedAt: { not: null } },
        }),
        this.prisma.issuedCertificate.count({ where: { tenantId } }),
        this.prisma.department.findMany({
          where: { tenantId },
          select: { id: true, name: true, code: true },
        }),
        this.prisma.designation.findMany({
          where: { tenantId },
          select: { id: true, name: true, level: true },
        }),
        this.prisma.employeeProfile.findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
          take: PlatformContextService.MAX_EMPLOYEES,
          select: {
            employeeCode: true,
            location: true,
            dateOfJoining: true,
            user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
            department: { select: { name: true } },
            designation: { select: { name: true, level: true } },
            reportingManager: { select: { firstName: true, lastName: true, email: true } },
          },
        }),
        this.prisma.document.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.document.findMany({
          where: { tenantId, status: { not: 'archived' } },
          orderBy: { updatedAt: 'desc' },
          take: PlatformContextService.MAX_DOCUMENTS,
          select: {
            title: true,
            status: true,
            type: true,
            fileName: true,
            tags: true,
            updatedAt: true,
            category: { select: { name: true } },
            uploadedBy: { select: { firstName: true, lastName: true, email: true } },
          },
        }),
        this.prisma.documentCategory.findMany({
          where: { tenantId },
          orderBy: { name: 'asc' },
          take: PlatformContextService.MAX_CATEGORIES,
          select: { name: true, _count: { select: { documents: true } } },
        }),
        this.prisma.milestone.findMany({
          where: { project: { tenantId } },
          orderBy: { createdAt: 'desc' },
          take: PlatformContextService.MAX_MILESTONES,
          select: {
            title: true,
            status: true,
            dueDate: true,
            completedAt: true,
            project: { select: { title: true } },
          },
        }),
        this.prisma.enrollment.findMany({
          where: { course: { tenantId } },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: {
            progress: true,
            completedAt: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            course: { select: { title: true } },
          },
        }),
        this.prisma.issuedCertificate.findMany({
          where: { tenantId },
          orderBy: { issuedAt: 'desc' },
          take: 15,
          select: {
            courseTitle: true,
            certificateNumber: true,
            issuedAt: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        }).catch(() => [] as Array<{
          courseTitle: string;
          certificateNumber: string;
          issuedAt: Date;
          user: { firstName: string | null; lastName: string | null; email: string } | null;
        }>),
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, slug: true },
        }).catch(() => null),
      ]);

      const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
      const desigNameById = new Map(designations.map((d) => [d.id, d.name]));

      const fmtDate = (d: Date | null) =>
        d ? new Date(d).toISOString().slice(0, 10) : '—';
      const fullName = (u: { firstName: string | null; lastName: string | null; email: string }) =>
        [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

      const lines: string[] = [];

      const snapshotAt = new Date().toISOString();
      lines.push(`## Live Platform Snapshot (generated at ${snapshotAt})`);
      lines.push(
        '- This snapshot is regenerated on every question. Treat every section below as the CURRENT state of the portal at the timestamp above; do not answer from earlier turns if this data disagrees with them.',
      );
      if (tenant) {
        lines.push(`- Organization: ${tenant.name} (${tenant.slug})`);
      }
      lines.push('');

      // ── Organization overview ──
      lines.push('## Organization Overview');
      lines.push(`- Users: ${userTotal} total, ${activeUserTotal} active`);
      lines.push(`- Employees (with profiles): ${employeeTotal}`);
      lines.push(`- Departments: ${departments.length}`);
      lines.push(`- Designations: ${designations.length}`);

      // ── Projects ──
      lines.push('');
      lines.push('## Projects');
      if (projectStatusCounts.length === 0) {
        lines.push('- No projects.');
      } else {
        const statusSummary = projectStatusCounts
          .map((s) => `${s.status}: ${s._count._all}`)
          .join(', ');
        lines.push(`- By status: ${statusSummary}`);
        lines.push(`- Most recently updated (up to ${PlatformContextService.MAX_PROJECTS}):`);
        for (const p of recentProjects) {
          const dept = p.department?.name ? ` | dept: ${p.department.name}` : '';
          const dates =
            p.status === 'completed'
              ? ` | completed: ${fmtDate(p.actualEndDate)}`
              : ` | target end: ${fmtDate(p.targetEndDate)}`;
          lines.push(
            `  • "${p.title}" — status: ${p.status} | owner: ${fullName(p.owner)}${dept} | start: ${fmtDate(p.startDate)}${dates} | ${p._count.milestones} milestone(s), ${p._count.members} member(s)`,
          );
        }
      }

      // ── Courses & learning ──
      lines.push('');
      lines.push('## Courses & Learning');
      if (courseStatusCounts.length === 0) {
        lines.push('- No courses.');
      } else {
        const courseSummary = courseStatusCounts
          .map((s) => `${s.status}: ${s._count._all}`)
          .join(', ');
        lines.push(`- Courses by status: ${courseSummary}`);
      }
      lines.push(
        `- Enrollments: ${enrollmentTotal} total, ${completedEnrollmentTotal} completed (${enrollmentTotal > 0 ? Math.round((completedEnrollmentTotal / enrollmentTotal) * 100) : 0}% completion)`,
      );
      lines.push(`- Certificates issued: ${certificateTotal}`);
      if (recentCourses.length > 0) {
        lines.push(`- Recent courses (up to ${PlatformContextService.MAX_COURSES}):`);
        for (const c of recentCourses) {
          lines.push(`  • "${c.title}" — status: ${c.status}, visibility: ${c.visibility}`);
        }
      }

      // ── Employees by department / designation ──
      lines.push('');
      lines.push('## Workforce Distribution');
      const deptDist = employeesByDepartment
        .map((e) => {
          const name = e.departmentId ? deptNameById.get(e.departmentId) ?? 'Unknown' : 'Unassigned';
          return `${name}: ${e._count._all}`;
        })
        .join(', ');
      lines.push(`- Employees by department: ${deptDist || 'n/a'}`);
      const desigDist = employeesByDesignation
        .map((e) => {
          const name = e.designationId ? desigNameById.get(e.designationId) ?? 'Unknown' : 'Unassigned';
          return `${name}: ${e._count._all}`;
        })
        .join(', ');
      lines.push(`- Employees by designation: ${desigDist || 'n/a'}`);

      // ── Employee roster (bounded) ──
      lines.push('');
      lines.push('## Recent Employees');
      if (recentEmployees.length === 0) {
        lines.push('- No employees.');
      } else {
        lines.push(`- Showing up to ${PlatformContextService.MAX_EMPLOYEES} most recently updated:`);
        for (const e of recentEmployees) {
          const name = fullName(e.user);
          const dept = e.department?.name ?? '—';
          const desig = e.designation
            ? `${e.designation.name}${e.designation.level ? ` (L${e.designation.level})` : ''}`
            : '—';
          const mgr = e.reportingManager ? fullName(e.reportingManager) : '—';
          const status = e.user.isActive ? 'active' : 'inactive';
          lines.push(
            `  • ${name} <${e.user.email}> — ${e.employeeCode} | ${desig} | dept: ${dept} | manager: ${mgr} | joined: ${fmtDate(e.dateOfJoining ?? null)} | ${status}`,
          );
        }
      }

      // ── Knowledge base ──
      lines.push('');
      lines.push('## Knowledge Base');
      if (documentStatusCounts.length === 0) {
        lines.push('- No documents uploaded yet.');
      } else {
        const docSummary = documentStatusCounts
          .map((s) => `${s.status}: ${s._count._all}`)
          .join(', ');
        lines.push(`- Documents by status: ${docSummary}`);
      }
      if (knowledgeCategories.length > 0) {
        const catSummary = knowledgeCategories
          .map((c) => `${c.name} (${c._count.documents})`)
          .join(', ');
        lines.push(`- Categories: ${catSummary}`);
      }
      if (recentDocuments.length > 0) {
        lines.push(`- Most recently updated documents (up to ${PlatformContextService.MAX_DOCUMENTS}):`);
        for (const d of recentDocuments) {
          const cat = d.category?.name ? ` | category: ${d.category.name}` : '';
          const tags = d.tags.length > 0 ? ` | tags: ${d.tags.join(', ')}` : '';
          const uploader = d.uploadedBy ? ` | by: ${fullName(d.uploadedBy)}` : '';
          lines.push(
            `  • "${d.title}" — ${d.type}/${d.status} | file: ${d.fileName}${cat}${tags}${uploader} | updated: ${fmtDate(d.updatedAt)}`,
          );
        }
      }

      // ── Recent milestones ──
      if (recentMilestones.length > 0) {
        lines.push('');
        lines.push('## Recent Milestones');
        for (const m of recentMilestones) {
          const done = m.completedAt ? ` | completed: ${fmtDate(m.completedAt)}` : '';
          lines.push(
            `  • "${m.title}" on "${m.project.title}" — status: ${m.status} | due: ${fmtDate(m.dueDate)}${done}`,
          );
        }
      }

      // ── Recent learning activity ──
      if (recentEnrollments.length > 0 || recentCertificates.length > 0) {
        lines.push('');
        lines.push('## Recent Learning Activity');
        for (const e of recentEnrollments) {
          const state = e.completedAt
            ? `completed on ${fmtDate(e.completedAt)}`
            : `in progress (${Math.round(e.progress * 100)}%)`;
          lines.push(
            `  • ${fullName(e.user)} enrolled in "${e.course.title}" — ${state} | started: ${fmtDate(e.createdAt)}`,
          );
        }
        for (const c of recentCertificates) {
          const holder = c.user ? fullName(c.user) : '—';
          lines.push(
            `  • Certificate "${c.courseTitle}" issued to ${holder} on ${fmtDate(c.issuedAt)} (# ${c.certificateNumber})`,
          );
        }
      }

      return lines.join('\n');
    } catch (err) {
      this.logger.warn(
        `Failed to build admin platform context: ${(err as Error).message}`,
      );
      return '';
    }
  }
}
