import {
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { Project } from "../types/project";

export function getProjects(params?: { status?: string; departmentId?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.departmentId) query.set("departmentId", params.departmentId);
  const qs = query.toString();
  return apiGet<{ data: Project[] }>(`/projects${qs ? `?${qs}` : ""}`);
}

// ── Query Keys ──────────────────────────────

export const projectKeys = {
  all: ["projects"] as const,
  list: (params?: { status?: string; departmentId?: string }) =>
    [
      "projects",
      { status: params?.status ?? null, departmentId: params?.departmentId ?? null },
    ] as const,
};

// ── Queries ─────────────────────────────────

// Lists projects via `GET /projects` (same request as `getProjects`). The
// `{ data }` envelope is unwrapped to `Project[]` so AsyncBoundary can detect
// an empty result set. `keepPreviousData` keeps the prior list visible while a
// new status filter loads (matches the pre-migration "no flash" behavior).
export function useProjects(params?: { status?: string; departmentId?: string }) {
  return useQuery<{ data: Project[] }, Error, Project[]>({
    queryKey: projectKeys.list(params),
    queryFn: () => getProjects(params),
    select: (res) => res.data,
    placeholderData: keepPreviousData,
  });
}

export function getProject(id: string) {
  return apiGet<{ data: Project }>(`/projects/${id}`);
}

export function createProject(data: { title: string; description?: string; departmentId?: string; startDate?: string; targetEndDate?: string }) {
  return apiPost<{ data: Project }>("/projects", data);
}

export function updateProject(id: string, data: Record<string, unknown>) {
  return apiPatch<{ data: Project }>(`/projects/${id}`, data);
}

export function updateProjectStatus(id: string, status: string) {
  return apiPatch<{ data: Project }>(`/projects/${id}/status`, { status });
}

export function deleteProject(id: string) {
  return apiDelete(`/projects/${id}`);
}

export function createMilestone(projectId: string, data: { title: string; description?: string; dueDate?: string; order: number }) {
  return apiPost(`/projects/${projectId}/milestones`, data);
}

export function updateMilestone(projectId: string, milestoneId: string, data: Record<string, unknown>) {
  return apiPatch(`/projects/${projectId}/milestones/${milestoneId}`, data);
}

export function addProjectMember(projectId: string, data: { userId: string; role?: string }) {
  return apiPost(`/projects/${projectId}/members`, data);
}

export function removeProjectMember(projectId: string, userId: string) {
  return apiDelete(`/projects/${projectId}/members/${userId}`);
}
