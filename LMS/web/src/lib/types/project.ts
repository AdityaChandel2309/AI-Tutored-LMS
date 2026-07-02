export interface Project {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: string;
  departmentId: string | null;
  ownerId: string;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  owner: { id: string; firstName: string | null; lastName: string | null; email: string };
  department?: { id: string; name: string } | null;
  milestones?: Milestone[];
  members?: ProjectMember[];
  _count?: { milestones: number; members: number };
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
}
