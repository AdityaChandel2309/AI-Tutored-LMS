import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { Department, Designation } from "../types/organization";

export function getDepartments() {
  return apiGet<{ data: Department[] }>("/departments");
}

export function getDepartment(id: string) {
  return apiGet<{ data: Department }>(`/departments/${id}`);
}

export function createDepartment(data: { name: string; code: string; parentId?: string; managerId?: string }) {
  return apiPost<{ data: Department }>("/departments", data);
}

export function updateDepartment(id: string, data: Partial<{ name: string; code: string; parentId: string | null; managerId: string | null }>) {
  return apiPatch<{ data: Department }>(`/departments/${id}`, data);
}

export function deleteDepartment(id: string) {
  return apiDelete(`/departments/${id}`);
}

export function getDesignations() {
  return apiGet<{ data: Designation[] }>("/designations");
}

export function createDesignation(data: { name: string; level: number }) {
  return apiPost<{ data: Designation }>("/designations", data);
}

export function updateDesignation(id: string, data: Partial<{ name: string; level: number }>) {
  return apiPatch<{ data: Designation }>(`/designations/${id}`, data);
}

export function deleteDesignation(id: string) {
  return apiDelete(`/designations/${id}`);
}

// ─── TanStack Query domain hooks ───────────
// Centralized react-query hooks for the organization (departments +
// designations) domain. The Next.js API routes relay the backend's `{ data }`
// envelope already unwrapped, so these read the bare arrays directly
// (e.g. `Department[]`, NOT `{ data: Department[] }`).

export const organizationKeys = {
  departments: ["departments"] as const,
  designations: ["designations"] as const,
};

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: organizationKeys.departments,
    // GET /api/departments → unwrapped Department[]
    queryFn: () => apiGet<Department[]>("/departments"),
  });
}

export function useDesignations() {
  return useQuery<Designation[]>({
    queryKey: organizationKeys.designations,
    // GET /api/designations → unwrapped Designation[]
    queryFn: () => apiGet<Designation[]>("/designations"),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation<
    Department,
    Error,
    { name: string; code: string; parentId?: string; managerId?: string }
  >({
    // POST /api/departments — same JSON body shape as createDepartment().
    mutationFn: (data) => apiPost<Department>("/departments", data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: organizationKeys.departments }),
  });
}

export function useCreateDesignation() {
  const qc = useQueryClient();
  return useMutation<Designation, Error, { name: string; level: number }>({
    // POST /api/designations — same JSON body shape as createDesignation().
    mutationFn: (data) => apiPost<Designation>("/designations", data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: organizationKeys.designations }),
  });
}
